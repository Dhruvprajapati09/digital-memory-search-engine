import { AppError } from "../../middleware/error.middleware";
import type { ParsedYouTubeUrl } from "../../types/youtube";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

/**
 * Extract YouTube video ID from supported URL formats.
 */
export function extractVideoId(rawUrl: string): string | null {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "www.").toLowerCase();
  const normalizedHost = parsed.hostname.toLowerCase();

  if (!YOUTUBE_HOSTS.has(normalizedHost)) {
    return null;
  }

  // youtu.be/VIDEO_ID
  if (normalizedHost === "youtu.be" || normalizedHost === "www.youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    return isValidVideoId(id) ? id : null;
  }

  // youtube.com/watch?v=VIDEO_ID
  const vParam = parsed.searchParams.get("v");
  if (vParam && isValidVideoId(vParam)) {
    return vParam;
  }

  // youtube.com/embed/VIDEO_ID or /shorts/VIDEO_ID or /live/VIDEO_ID
  const pathMatch = parsed.pathname.match(
    /^\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/
  );

  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  return null;
}

function isValidVideoId(value: string | undefined): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]{11}$/.test(value));
}

/**
 * Validate and normalize a YouTube URL.
 */
export function validateYouTubeUrl(rawUrl: unknown): ParsedYouTubeUrl {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new AppError("YouTube URL is required", 400);
  }

  const trimmed = rawUrl.trim();

  if (trimmed.length > 500) {
    throw new AppError("URL is too long", 400);
  }

  const videoId = extractVideoId(trimmed);

  if (!videoId) {
    throw new AppError(
      "Invalid YouTube URL. Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/",
      400
    );
  }

  return {
    videoId,
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}
