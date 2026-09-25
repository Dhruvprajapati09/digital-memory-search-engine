import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import DocumentModel from "../../models/Document";
import VideoModel from "../../models/Video";
import { env } from "../../config/env";
import { AppError } from "../../middleware/error.middleware";
import { resolveSafeUploadPath } from "../extractionService";
import { validateYouTubeUrl } from "./youtubeValidator";
import { fetchVideoMetadata } from "./metadataService";
import { fetchTranscript } from "./transcriptService";
import { buildSearchableTranscriptText } from "./transcriptCleaner";
import {
  runIndexingForDocument,
  queueIndexing,
} from "../indexingService";
import { upsertPageIndexForDocument } from "../documentSearch/pageIndexWriter";
import { formatDurationLabel } from "../../utils/timestamp";
import type {
  YouTubeImportResponse,
  YouTubeVideoSummary,
  VideoStatus,
} from "../../types/youtube";

function transcriptFileName(title: string): string {
  const safeTitle = title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 180);

  return `${safeTitle || "youtube-transcript"}.txt`;
}

async function persistTranscriptDocument(
  title: string,
  transcriptText: string,
  existingStoredFileName?: string
): Promise<{
  originalFileName: string;
  storedFileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}> {
  const storedFileName = existingStoredFileName || `${randomUUID()}.txt`;
  await writeFile(resolveSafeUploadPath(storedFileName), transcriptText, "utf8");

  return {
    originalFileName: transcriptFileName(title),
    storedFileName,
    filePath: `uploads/${storedFileName}`,
    fileSize: Buffer.byteLength(transcriptText, "utf8"),
    mimeType: "text/plain",
  };
}

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
  timeoutMs = 300000
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
      throw buildVideoIndexingError(document.indexError);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new AppError("Video indexing timed out", 504);
}

function buildVideoIndexingError(message?: string | null): AppError {
  const rawMessage = message ?? "Failed to index video transcript";
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limited") ||
    lower.includes("status 429")
  ) {
    return new AppError(
      "Mistral rate limit reached while indexing this YouTube transcript. Wait a minute, then import again or retry indexing.",
      429
    );
  }

  return new AppError(rawMessage, 500);
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
  }

  const transcriptDocument = await persistTranscriptDocument(
    metadata.title,
    transcriptText,
    document?.storedFileName
  );

  if (document) {
    document.title = metadata.title;
    document.originalFileName = transcriptDocument.originalFileName;
    document.storedFileName = transcriptDocument.storedFileName;
    document.filePath = transcriptDocument.filePath;
    document.fileSize = transcriptDocument.fileSize;
    document.mimeType = transcriptDocument.mimeType;
    document.sourceType = "youtube";
    document.sourceUrl = normalizedUrl;
    document.extractedText = transcriptText;
    document.extractionStatus = "completed";
    document.extractionError = null;
    document.indexStatus = "pending";
    document.indexError = null;
    await document.save();
  }

  if (!document) {
    document = await DocumentModel.create({
      userId,
      title: metadata.title,
      type: "video",
      originalFileName: transcriptDocument.originalFileName,
      storedFileName: transcriptDocument.storedFileName,
      filePath: transcriptDocument.filePath,
      fileSize: transcriptDocument.fileSize,
      mimeType: transcriptDocument.mimeType,
      extractedText: transcriptText,
      extractionStatus: "completed",
      indexStatus: "pending",
      videoId: video._id,
      youtubeVideoId: videoId,
      videoUrl: normalizedUrl,
      sourceType: "youtube",
      sourceUrl: normalizedUrl,
      videoChannel: metadata.channel,
      videoThumbnail: metadata.thumbnail,
      videoDuration: metadata.duration,
    });

    video.documentId = document._id;
    await video.save();
  }

  const documentId = document._id.toString();

  try {
    await upsertPageIndexForDocument(document);
  } catch (err) {
    console.error(`Failed to write PageIndex for video document ${documentId}:`, err);
  }

  if (options?.waitForIndex !== false) {
    let indexResult: { chunkCount: number; status: VideoStatus };

    try {
      await runIndexingForDocument(documentId);
      indexResult = await waitForIndexing(documentId);
    } catch (err) {
      video.status = "failed";
      video.chunkCount = 0;
      video.statusError =
        err instanceof Error
          ? err.message
          : "Failed to index video transcript";
      await video.save();
      throw err;
    }

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
