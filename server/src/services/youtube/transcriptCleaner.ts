import type { CleanedTranscript, TranscriptSegment } from "../../types/youtube";

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\u200b/g, "")
    .trim();
}

function normalizePunctuation(text: string): string {
  return text
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/([.,!?;:])+/g, "$1")
    .trim();
}

/**
 * Remove duplicate consecutive segments with identical text.
 */
function dedupeSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  const result: TranscriptSegment[] = [];

  for (const segment of segments) {
    const prev = result[result.length - 1];

    if (prev && prev.text.toLowerCase() === segment.text.toLowerCase()) {
      prev.endSeconds = Math.max(prev.endSeconds, segment.endSeconds);
      prev.durationSeconds = prev.endSeconds - prev.startSeconds;
      continue;
    }

    result.push({ ...segment });
  }

  return result;
}

/**
 * Merge adjacent segments when combined text stays under maxChars.
 */
function mergeAdjacentSegments(
  segments: TranscriptSegment[],
  maxChars = 240
): TranscriptSegment[] {
  if (segments.length === 0) return [];

  const merged: TranscriptSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i += 1) {
    const next = segments[i];
    const combinedLength = current.text.length + 1 + next.text.length;

    if (combinedLength <= maxChars) {
      current.text = `${current.text} ${next.text}`.trim();
      current.endSeconds = next.endSeconds;
      current.durationSeconds = current.endSeconds - current.startSeconds;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Clean raw transcript segments for chunking and search.
 */
export function cleanTranscript(
  segments: TranscriptSegment[],
  language?: string
): CleanedTranscript {
  const normalized = segments
    .map((segment) => ({
      ...segment,
      text: normalizePunctuation(normalizeText(segment.text)),
    }))
    .filter((segment) => segment.text.length > 0);

  const deduped = dedupeSegments(normalized);
  const merged = mergeAdjacentSegments(deduped);

  const fullText = merged.map((s) => s.text).join(" ").trim();

  return {
    segments: merged,
    fullText,
    language,
  };
}

/**
 * Build a searchable plain-text transcript with timestamp markers.
 */
export function buildSearchableTranscriptText(
  segments: TranscriptSegment[],
  videoTitle: string
): string {
  const lines = segments.map(
    (segment) => `[${formatSegmentTimestamp(segment.startSeconds)}] ${segment.text}`
  );

  return `# ${videoTitle}\n\n${lines.join("\n")}`;
}

function formatSegmentTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
