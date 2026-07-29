import { computeRecencyScore } from "../rankingService";
import type { RankedChunkHit } from "../../types/search";
import type {
  SearchV2RankedChunk,
  SearchV2StrategyPlan,
} from "../../types/searchV2";
import type {
  PersonalizationSignals,
} from "./personalizationService";
import { computePersonalizationScore } from "./personalizationService";

export interface DocumentMetaForSearchV2 {
  title: string;
  type: string;
  createdAt: Date;
}

function bounded(value: number | undefined): number {
  if (!value || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function textIncludes(value: string | undefined, queryTerms: string[]): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return queryTerms.some((term) => lower.includes(term));
}

export function computeCitationScore(
  chunk: RankedChunkHit,
  queryTerms: string[]
): number {
  let score = 0;

  if (textIncludes(chunk.metadata.heading as string | undefined, queryTerms)) {
    score += 0.45;
  }
  if (textIncludes(chunk.metadata.section as string | undefined, queryTerms)) {
    score += 0.25;
  }
  if (textIncludes(chunk.metadata.chapter as string | undefined, queryTerms)) {
    score += 0.15;
  }
  if (typeof chunk.metadata.pageNumber === "number") {
    score += 0.1;
  }
  if (chunk.title && textIncludes(chunk.title, queryTerms)) {
    score += 0.2;
  }

  return bounded(score);
}

export function applyLearningToRank(
  chunks: RankedChunkHit[],
  strategy: SearchV2StrategyPlan,
  documentMeta: Map<string, DocumentMetaForSearchV2>,
  personalization: PersonalizationSignals,
  queryTerms: string[]
): SearchV2RankedChunk[] {
  const now = new Date();

  return chunks
    .map((chunk) => {
      const meta = documentMeta.get(chunk.documentId);
      const freshnessScore = meta ? computeRecencyScore(meta.createdAt, now) : 0;
      const popularityScore = computePersonalizationScore(chunk, personalization);
      const citationScore = computeCitationScore(chunk, queryTerms);
      const weights = strategy.weights;

      const learningScore =
        bounded(chunk.vectorScore) * weights.vector +
        bounded(chunk.keywordScore) * weights.keyword +
        bounded(chunk.metadataScore + citationScore * 0.5) * weights.metadata +
        bounded(chunk.graphScore) * weights.graph +
        bounded(chunk.recencyScore) * weights.recency +
        bounded(chunk.crossEncoderScore ?? chunk.confidenceScore) *
          weights.crossEncoder +
        bounded(popularityScore) * weights.popularity +
        bounded(freshnessScore) * weights.freshness;

      return {
        chunk,
        learningScore: Math.round(learningScore * 10000) / 10000,
        popularityScore,
        freshnessScore,
        citationScore,
      };
    })
    .sort((a, b) => b.learningScore - a.learningScore);
}
