import { createHash } from "crypto";
import { env } from "../../config/env";
import type { RetrievedChunk } from "../../types/chat";

const JACCARD_THRESHOLD = 0.72;
const OVERLAP_THRESHOLD = 0.85;

function normalizeForHash(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function textHash(text: string): string {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex");
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeForHash(text)
      .split(/\W+/)
      .filter((t) => t.length >= 3)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / Math.min(a.size, b.size);
}

function isNearDuplicate(textA: string, textB: string): boolean {
  const setA = tokenSet(textA);
  const setB = tokenSet(textB);

  if (jaccardSimilarity(setA, setB) >= JACCARD_THRESHOLD) return true;
  if (overlapCoefficient(setA, setB) >= OVERLAP_THRESHOLD) return true;

  // One is substring of the other (repeated summaries)
  const normA = normalizeForHash(textA);
  const normB = normalizeForHash(textB);
  if (normA.length >= 40 && normB.length >= 40) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }

  return false;
}

/**
 * Remove exact duplicates, near-duplicates, and overlapping summaries.
 * Keeps highest-scoring instance.
 */
export function removeDuplicateChunks(
  chunks: RetrievedChunk[]
): RetrievedChunk[] {
  if (!env.ENABLE_DUPLICATE_REMOVAL || chunks.length <= 1) {
    return deduplicateExact(chunks);
  }

  const sorted = [...chunks].sort((a, b) => b.score - a.score);
  const kept: RetrievedChunk[] = [];
  const seenHashes = new Set<string>();
  const seenSummaries = new Set<string>();

  for (const chunk of sorted) {
    const key = `${chunk.metadata.documentId}:${chunk.metadata.chunkIndex}`;
    const hash = textHash(chunk.text);

    if (seenHashes.has(hash)) continue;

    let duplicate = false;
    for (const existing of kept) {
      if (isNearDuplicate(chunk.text, existing.text)) {
        duplicate = true;
        break;
      }
    }

    if (duplicate) continue;

    // Skip repeated summary-only blocks
    const summaryKey = normalizeForHash(chunk.summary ?? "").slice(0, 120);
    if (summaryKey.length >= 30 && seenSummaries.has(summaryKey)) continue;
    if (summaryKey.length >= 30) seenSummaries.add(summaryKey);

    seenHashes.add(hash);
    kept.push(chunk);
  }

  return kept;
}

export function deduplicateExact(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return dedupeExactInternal(chunks);
}

function dedupeExactInternal(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const byKey = new Map<string, RetrievedChunk>();

  for (const chunk of chunks) {
    const key = `${chunk.metadata.documentId}:${chunk.metadata.chunkIndex}`;
    const existing = byKey.get(key);
    if (!existing || chunk.score > existing.score) {
      byKey.set(key, chunk);
    }
  }

  return [...byKey.values()];
}

export { textHash, jaccardSimilarity, isNearDuplicate };
