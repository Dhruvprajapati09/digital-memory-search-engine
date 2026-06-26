import type {
  VectorSearchResult,
  KeywordSearchResult,
} from "../../types/embedding";

/** Reciprocal Rank Fusion — standard hybrid retrieval fusion (used by Perplexity-style systems) */
const RRF_K = 60;

export interface FusedSearchHit {
  vectorId: string;
  text: string;
  metadata: VectorSearchResult["metadata"];
  vectorScore: number;
  keywordScore: number;
  rrfScore: number;
  topic?: string;
  subtopic?: string;
  title?: string;
  summary?: string;
  keywords?: string[];
  tags?: string[];
  sectionPath?: string[];
  contentPreview?: string;
}

function normalizeHit(
  hit: VectorSearchResult | KeywordSearchResult
): Omit<FusedSearchHit, "vectorScore" | "keywordScore" | "rrfScore"> {
  return {
    vectorId: hit.vectorId,
    text: hit.text,
    metadata: hit.metadata,
    topic: hit.topic,
    subtopic: hit.subtopic,
    title: hit.title,
    summary: hit.summary,
    keywords: hit.keywords,
    tags: hit.tags,
    sectionPath: hit.sectionPath,
    contentPreview: hit.contentPreview,
  };
}

/**
 * Fuse vector and keyword ranked lists using Reciprocal Rank Fusion.
 * weightVector/weightKeyword scale each list's RRF contribution.
 */
export function fuseSearchResults(
  vectorHits: VectorSearchResult[],
  keywordHits: KeywordSearchResult[],
  options?: { weightVector?: number; weightKeyword?: number }
): FusedSearchHit[] {
  const weightVector = options?.weightVector ?? 0.6;
  const weightKeyword = options?.weightKeyword ?? 0.4;
  const fused = new Map<string, FusedSearchHit>();

  vectorHits.forEach((hit, rank) => {
    const rrf = weightVector / (RRF_K + rank + 1);
    const base = normalizeHit(hit);

    fused.set(hit.vectorId, {
      ...base,
      vectorScore: hit.score,
      keywordScore: 0,
      rrfScore: rrf,
    });
  });

  keywordHits.forEach((hit, rank) => {
    const rrf = weightKeyword / (RRF_K + rank + 1);
    const existing = fused.get(hit.vectorId);

    if (existing) {
      existing.keywordScore = hit.score;
      existing.rrfScore += rrf;
    } else {
      const base = normalizeHit(hit);
      fused.set(hit.vectorId, {
        ...base,
        vectorScore: 0,
        keywordScore: hit.score,
        rrfScore: rrf,
      });
    }
  });

  return [...fused.values()].sort((a, b) => b.rrfScore - a.rrfScore);
}

export { RRF_K };
