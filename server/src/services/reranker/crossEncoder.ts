import axios, { type AxiosInstance } from "axios";
import { env } from "../../config/env";
import type {
  CrossEncoderProvider,
  RerankDocument,
  RerankScore,
} from "./rerankerTypes";

let sharedHttpClient: AxiosInstance | null = null;

/** Reused HTTP client for all rerank providers */
export function getRerankHttpClient(): AxiosInstance {
  if (!sharedHttpClient) {
    sharedHttpClient = axios.create({
      timeout: env.RERANK_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });
  }
  return sharedHttpClient;
}

/** Reset client (for tests) */
export function resetRerankHttpClient(): void {
  sharedHttpClient = null;
}

export function normalizeCrossEncoderScores(scores: RerankScore[]): RerankScore[] {
  if (scores.length === 0) return scores;

  const values = scores.map((s) => s.score);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) {
    return scores.map((s) => ({ ...s, score: 1 }));
  }

  return scores.map((s) => ({
    ...s,
    score: Math.round(((s.score - min) / range) * 1000) / 1000,
  }));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** BAAI/bge-reranker-v2-m3 via Hugging Face Inference API */
export class BgeCrossEncoderProvider implements CrossEncoderProvider {
  readonly name = "bge";

  async rerank(query: string, documents: RerankDocument[]): Promise<RerankScore[]> {
    const apiKey = env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      throw new Error("HUGGINGFACE_API_KEY is required for BGE reranker");
    }

    const client = getRerankHttpClient();
    const model = env.BGE_RERANK_MODEL;
    const url = `https://api-inference.huggingface.co/models/${model}`;

    const pairs = documents.map((doc) => [query, doc.text]);
    const response = await client.post<number[] | { scores?: number[] }>(
      url,
      { inputs: pairs },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: env.RERANK_TIMEOUT_MS,
      }
    );

    const rawScores = Array.isArray(response.data)
      ? response.data
      : (response.data.scores ?? []);

    if (rawScores.length !== documents.length) {
      throw new Error(
        `BGE reranker returned ${rawScores.length} scores for ${documents.length} documents`
      );
    }

    const scored: RerankScore[] = documents.map((doc, i) => ({
      id: doc.id,
      rawScore: rawScores[i],
      score: sigmoid(rawScores[i]),
    }));

    return normalizeCrossEncoderScores(scored);
  }
}

/** Jina AI Reranker API */
export class JinaCrossEncoderProvider implements CrossEncoderProvider {
  readonly name = "jina";

  async rerank(query: string, documents: RerankDocument[]): Promise<RerankScore[]> {
    const apiKey = env.JINA_API_KEY;
    if (!apiKey) {
      throw new Error("JINA_API_KEY is required for Jina reranker");
    }

    const client = getRerankHttpClient();
    const response = await client.post<{
      results: Array<{ index: number; relevance_score: number }>;
    }>(
      "https://api.jina.ai/v1/rerank",
      {
        model: env.JINA_RERANK_MODEL,
        query,
        documents: documents.map((d) => d.text),
        top_n: documents.length,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: env.RERANK_TIMEOUT_MS,
      }
    );

    const byIndex = new Map<number, number>();
    for (const result of response.data.results) {
      byIndex.set(result.index, result.relevance_score);
    }

    const scored: RerankScore[] = documents.map((doc, i) => ({
      id: doc.id,
      rawScore: byIndex.get(i) ?? 0,
      score: byIndex.get(i) ?? 0,
    }));

    return normalizeCrossEncoderScores(scored);
  }
}

/** Cohere Rerank API */
export class CohereCrossEncoderProvider implements CrossEncoderProvider {
  readonly name = "cohere";

  async rerank(query: string, documents: RerankDocument[]): Promise<RerankScore[]> {
    const apiKey = env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error("COHERE_API_KEY is required for Cohere reranker");
    }

    const client = getRerankHttpClient();
    const response = await client.post<{
      results: Array<{ index: number; relevance_score: number }>;
    }>(
      "https://api.cohere.com/v1/rerank",
      {
        model: env.COHERE_RERANK_MODEL,
        query,
        documents: documents.map((d) => d.text),
        top_n: documents.length,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: env.RERANK_TIMEOUT_MS,
      }
    );

    const byIndex = new Map<number, number>();
    for (const result of response.data.results) {
      byIndex.set(result.index, result.relevance_score);
    }

    const scored: RerankScore[] = documents.map((doc, i) => ({
      id: doc.id,
      rawScore: byIndex.get(i) ?? 0,
      score: byIndex.get(i) ?? 0,
    }));

    return normalizeCrossEncoderScores(scored);
  }
}

/** Batch rerank calls for large candidate pools */
export async function batchRerank(
  provider: CrossEncoderProvider,
  query: string,
  documents: RerankDocument[],
  batchSize: number
): Promise<RerankScore[]> {
  if (documents.length === 0) return [];

  const allScores: RerankScore[] = [];

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const batchScores = await provider.rerank(query, batch);
    allScores.push(...batchScores);
  }

  return allScores;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Transient failures worth retrying; timeouts fail fast to preserve latency budget */
export function isRetryableRerankError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.message.includes("timed out")) return false;

  const axiosErr = err as Error & {
    response?: { status?: number };
    code?: string;
  };

  const status = axiosErr.response?.status;
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  const code = axiosErr.code;
  if (
    code === "ECONNRESET" ||
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND"
  ) {
    return true;
  }

  return err.message.includes("network") || err.message.includes("fetch failed");
}

/** Race rerank against a timeout */
export async function rerankWithTimeout(
  provider: CrossEncoderProvider,
  query: string,
  documents: RerankDocument[],
  batchSize: number,
  timeoutMs: number
): Promise<RerankScore[]> {
  const rerankPromise = batchRerank(provider, query, documents, batchSize);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Reranker timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([rerankPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** Retry transient provider failures, then surface error for caller fallback */
export async function rerankWithRetry(
  provider: CrossEncoderProvider,
  query: string,
  documents: RerankDocument[],
  batchSize: number,
  timeoutMs: number,
  maxRetries: number
): Promise<{ scores: RerankScore[]; retryAttempts: number }> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const scores = await rerankWithTimeout(
        provider,
        query,
        documents,
        batchSize,
        timeoutMs
      );
      return { scores, retryAttempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (!isRetryableRerankError(err) || attempt >= maxRetries) {
        throw lastError;
      }

      await sleep(Math.min(500 * 2 ** attempt, 4000));
    }
  }

  throw lastError ?? new Error("Reranker failed after retries");
}
