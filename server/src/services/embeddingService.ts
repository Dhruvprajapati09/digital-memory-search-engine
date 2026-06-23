import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env";
import type { EmbeddingResponse } from "../types/embedding";

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

let geminiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
    });
  }

  return geminiClient;
}

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
    message.includes("429")
  );
}

export async function generateEmbedding(
  text: string,
  options?: { taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" }
): Promise<EmbeddingResponse> {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Cannot generate embedding for empty text");
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = getClient();

      const response = await client.models.embedContent({
        model: env.EMBEDDING_MODEL || "gemini-embedding-001",
        contents: trimmed,
        ...(options?.taskType
          ? { config: { taskType: options.taskType } }
          : {}),
      });

      const vector = response.embeddings?.[0]?.values;

      if (!vector || vector.length === 0) {
        throw new Error("Gemini returned an empty embedding vector");
      }

      return {
        vector,
        model: env.EMBEDDING_MODEL || "gemini-embedding-001",
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

      throw lastError;
    }
  }

  throw lastError ?? new Error("Embedding generation failed");
}

export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<EmbeddingResponse[]> {
  const results: EmbeddingResponse[] = [];

  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }

  return results;
}

/** Optimized embedding for search queries (RETRIEVAL_QUERY task type). */
export async function generateQueryEmbedding(
  text: string
): Promise<EmbeddingResponse> {
  return generateEmbedding(text, { taskType: "RETRIEVAL_QUERY" });
}