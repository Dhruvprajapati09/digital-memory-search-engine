import { env } from "../../config/env";
import type { RankedChunkHit } from "../../types/search";
import {
  computeRecencyScore,
  normalizeConfidenceScores,
  type DocumentMetaForRanking,
} from "../rankingService";
import { rerankWithRetry } from "./crossEncoder";
import { createRerankProvider, resolveDefaultProviderId } from "./rerankerFactory";
import type {
  FinalScoreInputs,
  FinalScoreWeights,
  RerankDebugInfo,
  RerankDocument,
  RerankResult,
  RerankerServiceOptions,
  RankingChange,
} from "./rerankerTypes";

export function getFinalScoreWeights(): FinalScoreWeights {
  return {
    rerank: env.FINAL_SCORE_WEIGHT_RERANK,
    hybrid: env.FINAL_SCORE_WEIGHT_HYBRID,
    keyword: env.FINAL_SCORE_WEIGHT_KEYWORD,
    metadata: env.FINAL_SCORE_WEIGHT_METADATA,
    recency: env.FINAL_SCORE_WEIGHT_RECENCY,
  };
}

/** Weighted blend of cross-encoder and heuristic signals */
export function computeFinalScore(
  inputs: FinalScoreInputs,
  weights: FinalScoreWeights = getFinalScoreWeights()
): number {
  const score =
    weights.rerank * inputs.crossEncoderScore +
    weights.hybrid * inputs.hybridScore +
    weights.keyword * inputs.keywordScore +
    weights.metadata * inputs.metadataScore +
    weights.recency * inputs.recencyScore;

  return Math.round(score * 10000) / 10000;
}

/** Build rich rerank text from chunk metadata */
export function buildRerankDocumentText(
  hit: RankedChunkHit,
  documentTitle?: string
): string {
  const parts: string[] = [];

  if (documentTitle) parts.push(`Document: ${documentTitle}`);
  if (hit.title) parts.push(`Section: ${hit.title}`);
  if (hit.sectionPath && hit.sectionPath.length > 0) {
    parts.push(`Chapter: ${hit.sectionPath.join(" > ")}`);
  }
  if (hit.topic) parts.push(`Topic: ${hit.topic}`);
  if (hit.subtopic) parts.push(`Subtopic: ${hit.subtopic}`);
  if (hit.summary) parts.push(`Summary: ${hit.summary}`);
  if (hit.keywords && hit.keywords.length > 0) {
    parts.push(`Keywords: ${hit.keywords.join(", ")}`);
  }
  if (hit.tags && hit.tags.length > 0) {
    parts.push(`Tags: ${hit.tags.join(", ")}`);
  }
  if (hit.matchedKeywords.length > 0) {
    parts.push(`Entities: ${hit.matchedKeywords.join(", ")}`);
  }
  parts.push(hit.text);

  return parts.join("\n");
}

function toRerankDocuments(
  candidates: RankedChunkHit[],
  documentMeta: Map<string, DocumentMetaForRanking>
): RerankDocument[] {
  return candidates.map((hit) => {
    const docMeta = documentMeta.get(hit.documentId);
    const documentTitle =
      docMeta?.title ??
      (hit.metadata.documentTitle as string | undefined);

    return {
      id: hit.vectorId,
      text: buildRerankDocumentText(hit, documentTitle),
      metadata: {
        documentId: hit.documentId,
        chunkIndex: hit.chunkIndex,
        documentTitle,
      },
    };
  });
}

function computeRankingChanges(
  before: RankedChunkHit[],
  after: RankedChunkHit[]
): RankingChange[] {
  const beforeRank = new Map(before.map((c, i) => [c.vectorId, i + 1]));
  const changes: RankingChange[] = [];

  after.forEach((chunk, i) => {
    const rankBefore = beforeRank.get(chunk.vectorId) ?? i + 1;
    const rankAfter = i + 1;
    const delta = rankBefore - rankAfter;
    if (delta !== 0) {
      changes.push({
        vectorId: chunk.vectorId,
        rankBefore,
        rankAfter,
        delta,
      });
    }
  });

  return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function applyRerankScores(
  candidates: RankedChunkHit[],
  crossEncoderById: Map<string, number>,
  documentMeta: Map<string, DocumentMetaForRanking>,
  weights: FinalScoreWeights
): RankedChunkHit[] {
  const now = new Date();

  return candidates.map((hit) => {
    const crossEncoderScore = crossEncoderById.get(hit.vectorId) ?? 0;
    const hybridScore = hit.finalScore;
    const docMeta = documentMeta.get(hit.documentId);
    const recencyScore = docMeta
      ? computeRecencyScore(docMeta.createdAt, now)
      : 0;

    const finalScore = computeFinalScore(
      {
        crossEncoderScore,
        hybridScore,
        keywordScore: hit.keywordScore,
        metadataScore: hit.metadataScore,
        recencyScore,
      },
      weights
    );

    return {
      ...hit,
      crossEncoderScore,
      hybridScore,
      recencyScore,
      finalScore,
      confidenceScore: 0,
    };
  });
}

function hasProviderCredentials(providerId: string): boolean {
  switch (providerId.toLowerCase()) {
    case "jina":
      return Boolean(env.JINA_API_KEY);
    case "cohere":
      return Boolean(env.COHERE_API_KEY);
    case "bge":
    default:
      return Boolean(env.HUGGINGFACE_API_KEY);
  }
}

function buildSkippedDebug(provider: string, reason?: string): RerankDebugInfo {
  return {
    enabled: false,
    stage: "skipped",
    provider,
    candidateCount: 0,
    rerankLatencyMs: 0,
    ...(reason ? { error: reason } : {}),
  };
}

/**
 * Cross-encoder reranking stage — improves precision without replacing retrieval.
 * Falls back to heuristic ranking on failure or timeout.
 */
export async function rerankCandidates(
  options: RerankerServiceOptions
): Promise<RerankResult> {
  const providerId = resolveDefaultProviderId();
  const provider = createRerankProvider(providerId);
  const weights = getFinalScoreWeights();

  if (!env.ENABLE_RERANKER || options.candidates.length === 0) {
    return {
      chunks: options.candidates,
      debug: buildSkippedDebug(provider.name),
    };
  }

  if (!hasProviderCredentials(providerId)) {
    return {
      chunks: options.candidates,
      debug: buildSkippedDebug(
        provider.name,
        `No API key configured for ${provider.name} reranker`
      ),
    };
  }

  const candidateLimit = options.candidateLimit ?? env.RETRIEVAL_CANDIDATES;
  const pool = options.candidates.slice(
    0,
    Math.min(options.candidates.length, candidateLimit)
  );
  const tail = options.candidates.slice(pool.length);

  const startedAt = Date.now();

  try {
    const documents = toRerankDocuments(pool, options.documentMeta);
    const { scores, retryAttempts } = await rerankWithRetry(
      provider,
      options.query,
      documents,
      env.RERANK_BATCH_SIZE,
      env.RERANK_TIMEOUT_MS,
      env.RERANK_MAX_RETRIES
    );

    const crossEncoderById = new Map(scores.map((s) => [s.id, s.score]));
    const rerankedPool = applyRerankScores(
      pool,
      crossEncoderById,
      options.documentMeta,
      weights
    ).sort((a, b) => b.finalScore - a.finalScore);

    const topK = options.topK ?? env.RERANK_TOP_K;
    const prioritized = rerankedPool.slice(0, topK);
    const deprioritized = rerankedPool.slice(topK);
    const merged = [...prioritized, ...deprioritized, ...tail];
    const normalized = normalizeConfidenceScores(merged);

    const latencyMs = Date.now() - startedAt;

    const debug: RerankDebugInfo = {
      enabled: true,
      stage: "rerank",
      provider: provider.name,
      candidateCount: pool.length,
      rerankLatencyMs: latencyMs,
      retryAttempts,
      rankingChanges: computeRankingChanges(pool, rerankedPool),
    };

    if (env.ENABLE_SEARCH_DEBUG) {
      debug.crossEncoderScores = Object.fromEntries(crossEncoderById);
      debug.hybridScores = Object.fromEntries(
        pool.map((c) => [c.vectorId, c.finalScore])
      );
      debug.finalScores = Object.fromEntries(
        normalized.map((c) => [c.vectorId, c.finalScore])
      );
      debug.confidenceScores = Object.fromEntries(
        normalized.map((c) => [c.vectorId, c.confidenceScore])
      );
    }

    return { chunks: normalized, debug };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);

    return {
      chunks: options.candidates,
      debug: {
        enabled: true,
        stage: "fallback",
        provider: provider.name,
        candidateCount: pool.length,
        rerankLatencyMs: latencyMs,
        error: message,
      },
    };
  }
}

export const rerankerService = {
  rerank: rerankCandidates,
  computeFinalScore,
  getFinalScoreWeights,
  buildRerankDocumentText,
};
