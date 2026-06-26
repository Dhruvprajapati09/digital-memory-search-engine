import axios from "axios";
import { env } from "../../config/env";
import { AppError } from "../../middleware/error.middleware";
import {
  formatDurationLabel,
  parseIso8601Duration,
} from "../../utils/timestamp";
import type { VideoMetadata } from "../../types/youtube";

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

interface YouTubeApiVideoItem {
  snippet?: {
    title?: string;
    channelTitle?: string;
    description?: string;
    publishedAt?: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
  contentDetails?: {
    duration?: string;
  };
}

const METADATA_TIMEOUT_MS = 15_000;

/**
 * Fetch video metadata via YouTube Data API when configured, with oEmbed fallback.
 */
export async function fetchVideoMetadata(
  videoId: string,
  normalizedUrl: string
): Promise<VideoMetadata> {
  if (env.YOUTUBE_API_KEY) {
    try {
      return await fetchViaYouTubeApi(videoId, normalizedUrl);
    } catch (err) {
      console.warn(
        "[metadataService] YouTube API failed, falling back to oEmbed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return fetchViaOEmbed(videoId, normalizedUrl);
}

async function fetchViaYouTubeApi(
  videoId: string,
  normalizedUrl: string
): Promise<VideoMetadata> {
  const response = await axios.get<{ items?: YouTubeApiVideoItem[] }>(
    "https://www.googleapis.com/youtube/v3/videos",
    {
      params: {
        part: "snippet,contentDetails",
        id: videoId,
        key: env.YOUTUBE_API_KEY,
      },
      timeout: METADATA_TIMEOUT_MS,
    }
  );

  const item = response.data.items?.[0];

  if (!item?.snippet) {
    throw new AppError("Video not found or is unavailable", 404);
  }

  const durationIso = item.contentDetails?.duration ?? "PT0S";
  const durationSeconds = parseIso8601Duration(durationIso);

  if (
    env.MAX_VIDEO_DURATION_SECONDS > 0 &&
    durationSeconds > env.MAX_VIDEO_DURATION_SECONDS
  ) {
    throw new AppError(
      `Video exceeds maximum allowed duration of ${formatDurationLabel(env.MAX_VIDEO_DURATION_SECONDS)}`,
      400
    );
  }

  const thumbnail =
    item.snippet.thumbnails?.high?.url ??
    item.snippet.thumbnails?.medium?.url ??
    item.snippet.thumbnails?.default?.url ??
    "";

  return {
    videoId,
    title: item.snippet.title ?? "Untitled Video",
    channel: item.snippet.channelTitle ?? "Unknown Channel",
    description: item.snippet.description ?? "",
    duration: formatDurationLabel(durationSeconds),
    durationSeconds,
    thumbnail,
    publishedAt: item.snippet.publishedAt,
    language:
      item.snippet.defaultAudioLanguage ??
      item.snippet.defaultLanguage ??
      undefined,
    url: normalizedUrl,
  };
}

async function fetchViaOEmbed(
  videoId: string,
  normalizedUrl: string
): Promise<VideoMetadata> {
  try {
    const response = await axios.get<OEmbedResponse>(
      "https://www.youtube.com/oembed",
      {
        params: { url: normalizedUrl, format: "json" },
        timeout: METADATA_TIMEOUT_MS,
      }
    );

    return {
      videoId,
      title: response.data.title ?? "Untitled Video",
      channel: response.data.author_name ?? "Unknown Channel",
      description: "",
      duration: "",
      durationSeconds: 0,
      thumbnail: response.data.thumbnail_url ?? "",
      url: normalizedUrl,
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      throw new AppError("Video not found, is private, or has been deleted", 404);
    }

    if (axios.isAxiosError(err) && err.code === "ECONNABORTED") {
      throw new AppError("Timed out fetching video metadata", 504);
    }

    throw new AppError(
      `Failed to fetch video metadata: ${err instanceof Error ? err.message : String(err)}`,
      502
    );
  }
}
