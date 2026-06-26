import { YoutubeTranscript } from "youtube-transcript";
import axios from "axios";
import { env } from "../../config/env";
import { AppError } from "../../middleware/error.middleware";
import { cleanTranscript } from "./transcriptCleaner";
import type { CleanedTranscript, TranscriptSegment } from "../../types/youtube";

const TRANSCRIPT_TIMEOUT_MS = 30_000;

interface RawTranscriptItem {
  text: string;
  offset: number;
  duration: number;
}

/**
 * Fetch and clean a YouTube video transcript.
 */
export async function fetchTranscript(
  videoId: string,
  preferredLanguage?: string
): Promise<CleanedTranscript> {
  let rawItems: RawTranscriptItem[];

  try {
    rawItems = await fetchTranscriptWithTimeout(videoId, preferredLanguage);
  } catch (err) {
    throw mapTranscriptError(err);
  }

  if (!rawItems.length) {
    throw new AppError(
      "No transcript available for this video. Captions may be disabled.",
      422
    );
  }

  const segments: TranscriptSegment[] = rawItems.map((item) => {
    const startSeconds = item.offset / 1000;
    const durationSeconds = item.duration / 1000;
    const endSeconds = startSeconds + durationSeconds;

    return {
      text: item.text,
      startSeconds,
      endSeconds,
      durationSeconds,
    };
  });

  const cleaned = cleanTranscript(segments, preferredLanguage);

  if (
    env.MAX_TRANSCRIPT_SIZE > 0 &&
    cleaned.fullText.length > env.MAX_TRANSCRIPT_SIZE
  ) {
    throw new AppError(
      `Transcript exceeds maximum allowed size of ${env.MAX_TRANSCRIPT_SIZE} characters`,
      413
    );
  }

  if (!cleaned.fullText.trim()) {
    throw new AppError("Transcript is empty after cleaning", 422);
  }

  return cleaned;
}

async function fetchTranscriptWithTimeout(
  videoId: string,
  preferredLanguage?: string
): Promise<RawTranscriptItem[]> {
  const fetchPromise = YoutubeTranscript.fetchTranscript(videoId, {
    lang: preferredLanguage,
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Transcript fetch timed out")),
      TRANSCRIPT_TIMEOUT_MS
    );
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

function mapTranscriptError(err: unknown): AppError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return new AppError("Timed out fetching video transcript", 504);
  }

  if (
    lower.includes("transcript is disabled") ||
    lower.includes("no transcript") ||
    lower.includes("could not retrieve")
  ) {
    return new AppError(
      "No transcript available for this video. Captions may be disabled.",
      422
    );
  }

  if (lower.includes("video unavailable") || lower.includes("private")) {
    return new AppError("Video is private, deleted, or unavailable", 404);
  }

  if (axios.isAxiosError(err) && err.response?.status === 429) {
    return new AppError("YouTube rate limit reached. Try again later.", 429);
  }

  return new AppError(`Failed to fetch transcript: ${message}`, 502);
}
