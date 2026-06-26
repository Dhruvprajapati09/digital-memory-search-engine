import DocumentModel from "../../models/Document";
import VideoModel from "../../models/Video";
import { env } from "../../config/env";
import { AppError } from "../../middleware/error.middleware";
import { validateYouTubeUrl } from "./youtubeValidator";
import { fetchVideoMetadata } from "./metadataService";
import { fetchTranscript } from "./transcriptService";
import { buildSearchableTranscriptText } from "./transcriptCleaner";
import {
  runIndexingForDocument,
  queueIndexing,
} from "../indexingService";
import { formatDurationLabel } from "../../utils/timestamp";
import type {
  YouTubeImportResponse,
  YouTubeVideoSummary,
  VideoStatus,
} from "../../types/youtube";

function toVideoSummary(
  video: {
    _id: { toString(): string };
    videoId: string;
    title: string;
    channel: string;
    duration: string;
    thumbnail: string;
    language?: string;
    url: string;
    status: VideoStatus;
    documentId?: { toString(): string };
    chunkCount: number;
  },
  duplicate = false
): YouTubeImportResponse {
  return {
    success: true,
    duplicate,
    chunksIndexed: video.chunkCount,
    video: {
      id: video._id.toString(),
      videoId: video.videoId,
      title: video.title,
      channel: video.channel,
      duration: video.duration,
      thumbnail: video.thumbnail,
      language: video.language,
      url: video.url,
      status: video.status,
      documentId: video.documentId?.toString(),
    },
  };
}

async function waitForIndexing(
  documentId: string,
  timeoutMs = 120000
): Promise<{ chunkCount: number; status: VideoStatus }> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const document = await DocumentModel.findById(documentId)
      .select("indexStatus chunkCount indexError")
      .lean();

    if (!document) {
      return { chunkCount: 0, status: "failed" };
    }

    if (document.indexStatus === "indexed") {
      return { chunkCount: document.chunkCount ?? 0, status: "indexed" };
    }

    if (document.indexStatus === "failed") {
      throw new AppError(
        document.indexError ?? "Failed to index video transcript",
        500
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new AppError("Video indexing timed out", 504);
}

/**
 * Import a YouTube video: metadata → transcript → document → index.
 */
export async function importYouTubeVideo(
  userId: string,
  rawUrl: string,
  options?: { waitForIndex?: boolean }
): Promise<YouTubeImportResponse> {
  if (!env.ENABLE_YOUTUBE_IMPORT) {
    throw new AppError("YouTube import is disabled", 503);
  }

  const { videoId, normalizedUrl } = validateYouTubeUrl(rawUrl);

  const existing = await VideoModel.findOne({ userId, videoId });

  if (existing?.status === "indexed" && existing.documentId) {
    return toVideoSummary(existing, true);
  }

  const metadata = await fetchVideoMetadata(videoId, normalizedUrl);

  let cleanedTranscript;

  try {
    cleanedTranscript = await fetchTranscript(videoId, metadata.language);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 422) {
      await VideoModel.findOneAndUpdate(
        { userId, videoId },
        {
          userId,
          videoId,
          url: normalizedUrl,
          title: metadata.title,
          description: metadata.description,
          channel: metadata.channel,
          thumbnail: metadata.thumbnail,
          duration: metadata.duration,
          durationSeconds: metadata.durationSeconds,
          language: metadata.language,
          publishedAt: metadata.publishedAt
            ? new Date(metadata.publishedAt)
            : undefined,
          transcript: "",
          transcriptSegments: [],
          status: "no_transcript",
          statusError: err.message,
          chunkCount: 0,
        },
        { upsert: true, new: true }
      );

      throw err;
    }

    throw err;
  }

  const transcriptText = buildSearchableTranscriptText(
    cleanedTranscript.segments,
    metadata.title
  );

  if (
    metadata.durationSeconds === 0 &&
    cleanedTranscript.segments.length > 0
  ) {
    const lastSegment =
      cleanedTranscript.segments[cleanedTranscript.segments.length - 1];
    metadata.durationSeconds = Math.ceil(lastSegment.endSeconds);
    metadata.duration = formatDurationLabel(metadata.durationSeconds);
  }

  let video = existing;

  if (!video) {
    video = await VideoModel.create({
      userId,
      videoId,
      url: normalizedUrl,
      title: metadata.title,
      description: metadata.description,
      channel: metadata.channel,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      durationSeconds: metadata.durationSeconds,
      language: cleanedTranscript.language ?? metadata.language,
      publishedAt: metadata.publishedAt
        ? new Date(metadata.publishedAt)
        : undefined,
      transcript: transcriptText,
      transcriptSegments: cleanedTranscript.segments,
      status: "processing",
      chunkCount: 0,
    });
  } else {
    video.title = metadata.title;
    video.description = metadata.description;
    video.channel = metadata.channel;
    video.thumbnail = metadata.thumbnail;
    video.duration = metadata.duration;
    video.durationSeconds = metadata.durationSeconds;
    video.language = cleanedTranscript.language ?? metadata.language;
    video.transcript = transcriptText;
    video.transcriptSegments = cleanedTranscript.segments;
    video.status = "processing";
    video.statusError = null;
    await video.save();
  }

  let document;

  if (video.documentId) {
    document = await DocumentModel.findById(video.documentId);

    if (document) {
      document.title = metadata.title;
      document.extractedText = transcriptText;
      document.extractionStatus = "completed";
      document.extractionError = null;
      document.indexStatus = "pending";
      document.indexError = null;
      await document.save();
    }
  }

  if (!document) {
    document = await DocumentModel.create({
      userId,
      title: metadata.title,
      type: "video",
      extractedText: transcriptText,
      extractionStatus: "completed",
      indexStatus: "pending",
      videoId: video._id,
      youtubeVideoId: videoId,
      videoUrl: normalizedUrl,
      videoChannel: metadata.channel,
      videoThumbnail: metadata.thumbnail,
      videoDuration: metadata.duration,
    });

    video.documentId = document._id;
    await video.save();
  }

  const documentId = document._id.toString();

  if (options?.waitForIndex !== false) {
    await runIndexingForDocument(documentId);
    const indexResult = await waitForIndexing(documentId);

    video.status = indexResult.status;
    video.chunkCount = indexResult.chunkCount;
    video.statusError = null;
    await video.save();

    return toVideoSummary(video);
  }

  queueIndexing(documentId);

  video.status = "processing";
  await video.save();

  return toVideoSummary(video);
}

export async function getVideoById(
  userId: string,
  videoRecordId: string
): Promise<YouTubeVideoSummary | null> {
  const video = await VideoModel.findOne({ _id: videoRecordId, userId }).lean();

  if (!video) return null;

  return {
    id: video._id.toString(),
    videoId: video.videoId,
    title: video.title,
    channel: video.channel,
    duration: video.duration,
    thumbnail: video.thumbnail,
    language: video.language,
    url: video.url,
    status: video.status,
    documentId: video.documentId?.toString(),
    chunksIndexed: video.chunkCount,
  };
}
