import { getMistralClient } from "./ai/aiService";
import { env } from "../config/env";
import type { EmbeddingInputType } from "../types/ai";
import type { EmbeddingResponse } from "../types/embedding";

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const DEFAULT_BATCH_SIZE = 16;
const BATCH_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const message = err.message.toLowerCase();

  return (
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("429") ||
    message.includes("econnreset")
  );
}

/**
 * Embedding service — generates vectors via Mistral Embeddings API.
 *
 * Uses mistral-embed by default (fixed 1024 dimensions). Do not pass
 * output_dimension — only codestral-embed supports that parameter.
 * Vectors are stored in Pinecone, not MongoDB.
 */
function assertEmbeddingDimension(vector: number[]): void {
  if (vector.length !== env.PINECONE_EMBEDDING_DIMENSION) {
    throw new Error(
      `Embedding dimension mismatch: got ${vector.length}, expected ${env.PINECONE_EMBEDDING_DIMENSION}. ` +
        `Update PINECONE_EMBEDDING_DIMENSION or recreate the Pinecone index to match ${env.MISTRAL_EMBEDDING_MODEL}.`
    );
  }
}
export async function generateEmbedding(
  text: string,
  _options?: { taskType?: EmbeddingInputType }
): Promise<EmbeddingResponse> {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Cannot generate embedding for empty text");
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const client = getMistralClient();

      const response = await client.embeddings.create({
        model: env.MISTRAL_EMBEDDING_MODEL,
        inputs: trimmed,
      });

      const vector = response.data?.[0]?.embedding;

      if (!vector || vector.length === 0) {
        throw new Error("Mistral returned an empty embedding vector");
      }

      assertEmbeddingDimension(vector);

      return {
        vector,
        model: response.model ?? env.MISTRAL_EMBEDDING_MODEL,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES && isRetryableError(err)) {
        const delay = RETRY_BASE_DELAY_MS * attempt;

        console.warn(
          `[embeddingService] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms:`,
          lastError.message
        );

        await sleep(delay);
        continue;
      }

      throw new Error(`Mistral embedding API failed: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error("Embedding generation failed");
}

/**
 * Batch embedding with concurrency control.
 * Mistral accepts array inputs — we batch to respect rate limits.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options?: {
    taskType?: EmbeddingInputType;
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<EmbeddingResponse[]> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const results: EmbeddingResponse[] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await generateEmbeddingsBatchInternal(batch);

    for (let j = 0; j < batchResults.length; j += 1) {
      results[i + j] = batchResults[j];
    }

    options?.onProgress?.(Math.min(i + batchSize, texts.length), texts.length);

    if (i + batchSize < texts.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
}

async function generateEmbeddingsBatchInternal(
  texts: string[]
): Promise<EmbeddingResponse[]> {
  const nonEmpty = texts.map((t) => t.trim());

  if (nonEmpty.some((t) => !t)) {
    throw new Error("Cannot generate embeddings for empty text in batch");
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const client = getMistralClient();

      const response = await client.embeddings.create({
        model: env.MISTRAL_EMBEDDING_MODEL,
        inputs: nonEmpty,
      });

      if (!response.data || response.data.length !== nonEmpty.length) {
        throw new Error(
          `Mistral returned ${response.data?.length ?? 0} embeddings for ${nonEmpty.length} inputs`
        );
      }

      return response.data.map((item, index) => {
        const vector = item.embedding;

        if (!vector || vector.length === 0) {
          throw new Error(`Mistral returned empty embedding at index ${index}`);
        }

        assertEmbeddingDimension(vector);

        return {
          vector,
          model: response.model ?? env.MISTRAL_EMBEDDING_MODEL,
        };
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES && isRetryableError(err)) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      throw new Error(`Mistral batch embedding failed: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error("Batch embedding generation failed");
}

/** Optimized embedding for search and RAG queries */
export async function generateQueryEmbedding(
  text: string
): Promise<EmbeddingResponse> {
  return generateEmbedding(text, { taskType: { kind: "query" } });
}

/** Validate Mistral connectivity and embedding dimension at startup */
export async function validateMistralEmbeddingConfig(): Promise<{
  model: string;
  dimension: number;
}> {
  const client = getMistralClient();

  const response = await client.embeddings.create({
    model: env.MISTRAL_EMBEDDING_MODEL,
    inputs: ["connectivity check"],
  });

  const dimension = response.data?.[0]?.embedding?.length ?? 0;

  if (dimension === 0) {
    throw new Error("Mistral returned an empty embedding vector during validation");
  }

  assertEmbeddingDimension(response.data![0].embedding!);

  return {
    model: response.model ?? env.MISTRAL_EMBEDDING_MODEL,
    dimension,
  };
}

export { DEFAULT_BATCH_SIZE };
