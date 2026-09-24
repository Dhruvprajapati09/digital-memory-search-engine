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
  lang?: string;
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
    rawItems = await fetchTranscriptWithFallbacks(videoId, preferredLanguage);
  } catch (err) {
    throw mapTranscriptError(err);
  }

  if (!rawItems.length) {
    throw new AppError(
      "No transcript available for this video. Captions may be disabled.",
      422
    );
  }

  const timingScale = inferTimingScale(rawItems);
  const transcriptLanguage = rawItems.find((item) => item.lang)?.lang;

  const segments: TranscriptSegment[] = rawItems.map((item) => {
    const startSeconds = item.offset / timingScale;
    const durationSeconds = item.duration / timingScale;
    const endSeconds = startSeconds + durationSeconds;

    return {
      text: item.text,
      startSeconds,
      endSeconds,
      durationSeconds,
    };
  });

  const cleaned = cleanTranscript(
    segments,
    transcriptLanguage ?? preferredLanguage
  );

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

async function fetchTranscriptWithFallbacks(
  videoId: string,
  preferredLanguage?: string
): Promise<RawTranscriptItem[]> {
  const languages = buildLanguageFallbacks(preferredLanguage);
  let lastError: unknown;

  for (const language of languages) {
    try {
      const items = await fetchTranscriptWithTimeout(videoId, language);
      if (items.length > 0) return items;
    } catch (err) {
      lastError = err;

      if (!shouldTryNextLanguage(err)) {
        throw err;
      }
    }
  }

  if (lastError) throw lastError;
  return [];
}

function buildLanguageFallbacks(preferredLanguage?: string): Array<string | undefined> {
  const fallbacks: Array<string | undefined> = [];
  const normalized = preferredLanguage?.trim();

  if (normalized) {
    fallbacks.push(normalized);

    const baseLanguage = normalized.split(/[-_]/)[0];
    if (baseLanguage && baseLanguage !== normalized) {
      fallbacks.push(baseLanguage);
    }
  }

  fallbacks.push(undefined);
  return [...new Set(fallbacks)];
}

async function fetchTranscriptWithTimeout(
  videoId: string,
  preferredLanguage?: string
): Promise<RawTranscriptItem[]> {
  const fetchPromise = YoutubeTranscript.fetchTranscript(
    videoId,
    preferredLanguage ? { lang: preferredLanguage } : undefined
  );

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Transcript fetch timed out")),
      TRANSCRIPT_TIMEOUT_MS
    );
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

function shouldTryNextLanguage(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  return (
    lower.includes("not available language") ||
    lower.includes("no transcripts are available in") ||
    lower.includes("available languages")
  );
}

function inferTimingScale(items: RawTranscriptItem[]): 1 | 1000 {
  const maxOffset = Math.max(...items.map((item) => item.offset), 0);
  const maxDuration = Math.max(...items.map((item) => item.duration), 0);
  const maxExpectedSeconds =
    env.MAX_VIDEO_DURATION_SECONDS > 0
      ? env.MAX_VIDEO_DURATION_SECONDS + 300
      : 24 * 60 * 60;

  if (maxOffset > maxExpectedSeconds || maxDuration > 120) {
    return 1000;
  }

  return 1;
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
    lower.includes("no transcripts are available") ||
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
