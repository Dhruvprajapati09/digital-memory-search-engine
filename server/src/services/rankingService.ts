import type { VectorSearchResult } from "../types/embedding";
import type { RankedDocumentGroup } from "../types/search";

/** Weights for composite ranking — tuned for semantic search with keyword boost */
const WEIGHTS = {
  vector: 0.65,
  keyword: 0.2,
  chunkCount: 0.1,
  recency: 0.05,
} as const;

const MAX_CHUNK_BONUS = 5;

export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^\w-]/g, ""))
    .filter((term) => term.length >= 2);
}

/**
 * Score how many query terms appear in the combined chunk text.
 * Returns 0–1 normalized score.
 */
export function computeKeywordScore(text: string, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;

  const lowerText = text.toLowerCase();
  let matches = 0;

  for (const term of queryTerms) {
    if (lowerText.includes(term)) {
      matches += 1;
    }
  }

  return matches / queryTerms.length;
}

/**
 * Recency bonus: newer documents get a small boost (0–1 over ~90 days).
 */
export function computeRecencyScore(createdAt: Date, now = new Date()): number {
  const ageMs = now.getTime() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const decay = Math.max(0, 1 - ageDays / 90);
  return decay;
}

interface DocumentChunkMatch {
  documentId: string;
  title: string;
  type: string;
  createdAt: Date;
  chunks: VectorSearchResult[];
}

/**
 * Group vector hits by document and compute a composite relevance score.
 */
export function rankDocumentGroups(
  matches: VectorSearchResult[],
  documentMeta: Map<
    string,
    { title: string; type: string; createdAt: Date }
  >,
  query: string
): RankedDocumentGroup[] {
  const queryTerms = tokenizeQuery(query);
  const grouped = new Map<string, DocumentChunkMatch>();

  for (const hit of matches) {
    const documentId = hit.metadata.documentId;

    if (!documentId) continue;

    const meta = documentMeta.get(documentId);

    if (!meta) continue;

    const existing = grouped.get(documentId);

    if (existing) {
      existing.chunks.push(hit);
    } else {
      grouped.set(documentId, {
        documentId,
        title: meta.title,
        type: meta.type,
        createdAt: meta.createdAt,
        chunks: [hit],
      });
    }
  }

  const ranked: RankedDocumentGroup[] = [];

  for (const group of grouped.values()) {
    const sortedChunks = [...group.chunks].sort((a, b) => b.score - a.score);
    const topVectorScore = sortedChunks[0]?.score ?? 0;
    const combinedText = sortedChunks.map((c) => c.text).join(" ");
    const keywordScore = computeKeywordScore(combinedText, queryTerms);
    const chunkBonus =
      Math.min(sortedChunks.length, MAX_CHUNK_BONUS) / MAX_CHUNK_BONUS;
    const recencyScore = computeRecencyScore(group.createdAt);

    const finalScore =
      topVectorScore * WEIGHTS.vector +
      keywordScore * WEIGHTS.keyword +
      chunkBonus * WEIGHTS.chunkCount +
      recencyScore * WEIGHTS.recency;

    ranked.push({
      documentId: group.documentId,
      title: group.title,
      type: group.type as RankedDocumentGroup["type"],
      createdAt: group.createdAt,
      matchedChunks: sortedChunks.map((c) => ({
        chunkIndex: c.metadata.chunkIndex,
        score: c.score,
        text: c.text,
      })),
      vectorScore: topVectorScore,
      keywordScore,
      chunkCount: sortedChunks.length,
      finalScore,
      bestChunkText: sortedChunks[0]?.text ?? "",
    });
  }

  return ranked.sort((a, b) => b.finalScore - a.finalScore);
}

/** Generate a readable preview snippet centered on query terms (200–300 chars). */
export function generatePreviewSnippet(
  text: string,
  query: string,
  minLength = 200,
  maxLength = 300
): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const queryTerms = tokenizeQuery(query);
  const lowerText = normalized.toLowerCase();

  let anchorIndex = 0;

  for (const term of queryTerms) {
    const idx = lowerText.indexOf(term);

    if (idx >= 0) {
      anchorIndex = idx;
      break;
    }
  }

  const halfWindow = Math.floor(maxLength / 2);
  let start = Math.max(0, anchorIndex - halfWindow);
  let end = Math.min(normalized.length, start + maxLength);

  if (end - start < minLength) {
    start = Math.max(0, end - minLength);
  }

  let snippet = normalized.slice(start, end).trim();

  if (start > 0) {
    snippet = `...${snippet}`;
  }

  if (end < normalized.length) {
    snippet = `${snippet}...`;
  }

  return snippet;
}
