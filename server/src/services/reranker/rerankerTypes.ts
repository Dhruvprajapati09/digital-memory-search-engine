import type { RankedChunkHit } from "../../types/search";
import type { DocumentMetaForRanking } from "../rankingService";

/** Input document passed to a cross-encoder provider */
export interface RerankDocument {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

/** Single scored result from a cross-encoder provider */
export interface RerankScore {
  id: string;
  score: number;
  /** Provider-native score before normalization */
  rawScore?: number;
}

/** Provider contract — swappable rerank backends */
export interface CrossEncoderProvider {
  readonly name: string;
  rerank(query: string, documents: RerankDocument[]): Promise<RerankScore[]>;
}

export interface RerankerServiceOptions {
  query: string;
  candidates: RankedChunkHit[];
  documentMeta: Map<string, DocumentMetaForRanking>;
  /** Max candidates sent to the cross-encoder (defaults to env) */
  candidateLimit?: number;
  /** Top-K reranked results to prioritize (defaults to env) */
  topK?: number;
}

export interface RankingChange {
  vectorId: string;
  rankBefore: number;
  rankAfter: number;
  delta: number;
}

export interface RerankDebugInfo {
  enabled: boolean;
  stage: "rerank" | "fallback" | "skipped";
  provider: string;
  candidateCount: number;
  rerankLatencyMs: number;
  /** Number of provider retries before success or fallback */
  retryAttempts?: number;
  crossEncoderScores?: Record<string, number>;
  hybridScores?: Record<string, number>;
  finalScores?: Record<string, number>;
  confidenceScores?: Record<string, number>;
  rankingChanges?: RankingChange[];
  error?: string;
}

export interface RerankResult {
  chunks: RankedChunkHit[];
  debug: RerankDebugInfo;
}

export interface FinalScoreWeights {
  rerank: number;
  hybrid: number;
  keyword: number;
  metadata: number;
  recency: number;
}

export interface FinalScoreInputs {
  crossEncoderScore: number;
  hybridScore: number;
  keywordScore: number;
  metadataScore: number;
  recencyScore: number;
}
