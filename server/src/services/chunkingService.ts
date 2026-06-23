import type { TextChunkInput } from "../types/embedding";

/** Target chunk size in words (500–800 range) */
const TARGET_CHUNK_WORDS = 700;

/** Overlap between consecutive chunks in words */
const OVERLAP_WORDS = 100;

function splitIntoWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Split extracted text into overlapping word-based chunks.
 * Preserves context across chunk boundaries for better semantic search.
 */
export function chunkText(text: string): TextChunkInput[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const words = splitIntoWords(trimmed);
  if (words.length === 0) return [];

  const chunks: TextChunkInput[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < words.length) {
    const end = Math.min(start + TARGET_CHUNK_WORDS, words.length);
    const chunkWords = words.slice(start, end);

    chunks.push({
      chunkIndex,
      text: chunkWords.join(" "),
    });

    chunkIndex += 1;

    if (end >= words.length) break;

    start += TARGET_CHUNK_WORDS - OVERLAP_WORDS;
  }

  return chunks;
}

export { TARGET_CHUNK_WORDS, OVERLAP_WORDS };
