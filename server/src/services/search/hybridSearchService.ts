import type {
  VectorSearchResult,
  KeywordSearchResult,
} from "../../types/embedding";
import { env } from "../../config/env";

/** Reciprocal Rank Fusion — standard hybrid retrieval fusion (used by Perplexity-style systems) */
const DEFAULT_RRF_K = 60;

export interface FusedSearchHit {
  vectorId: string;
  text: string;
  metadata: VectorSearchResult["metadata"];
  vectorScore: number;
  keywordScore: number;
  rrfScore: number;
  graphScore?: number;
  graphConfidence?: number;
  graphMatchedNodes?: Array<{
    nodeId: string;
    type: string;
    label: string;
    score: number;
    depth: number;
  }>;
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
  options?: {
    weightVector?: number;
    weightKeyword?: number;
    rrfK?: number;
  }
): FusedSearchHit[] {
  const weightVector = options?.weightVector ?? env.RRF_WEIGHT_VECTOR;
  const weightKeyword = options?.weightKeyword ?? env.RRF_WEIGHT_KEYWORD;
  const rrfK = options?.rrfK ?? env.RRF_K ?? DEFAULT_RRF_K;
  const fused = new Map<string, FusedSearchHit>();

  vectorHits.forEach((hit, rank) => {
    const rrf = weightVector / (rrfK + rank + 1);
    const base = normalizeHit(hit);

    fused.set(hit.vectorId, {
      ...base,
      vectorScore: hit.score,
      keywordScore: 0,
      rrfScore: rrf,
    });
  });

  keywordHits.forEach((hit, rank) => {
    const rrf = weightKeyword / (rrfK + rank + 1);
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

export { DEFAULT_RRF_K as RRF_K };
