import { Mistral } from "@mistralai/mistralai";
import { env } from "../../config/env";
import type {
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatMessage,
} from "../../types/ai";

let mistralClient: Mistral | null = null;

/**
 * Centralized Mistral AI client.
 *
 * Single entry point for all LLM calls — keeps API key handling,
 * client lifecycle, and error normalization in one place.
 */
export function getMistralClient(): Mistral {
  if (!env.MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }

  if (!mistralClient) {
    mistralClient = new Mistral({ apiKey: env.MISTRAL_API_KEY });
  }

  return mistralClient;
}

function isRetryableMistralError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const message = err.message.toLowerCase();
  return (
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("timed out")
  );
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`LLM request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function extractAnswerContent(content: unknown): string {
  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : "text" in part
            ? String(part.text ?? "")
            : ""
      )
      .join("")
      .trim();
  }

  return "";
}
/**
 * Generate a chat completion using Mistral.
 * Used by the RAG pipeline to produce grounded answers from retrieved context.
 */
export async function generateChatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const model = options?.model ?? env.MISTRAL_CHAT_MODEL;
  const temperature = options?.temperature ?? env.MISTRAL_CHAT_TEMPERATURE;
  const maxTokens = options?.maxTokens ?? env.MAX_OUTPUT_TOKENS;
  const timeoutMs = env.AI_REQUEST_TIMEOUT_MS;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const client = getMistralClient();

      const response = await withTimeout(
        client.chat.complete({
          model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature,
          maxTokens,
        }),
        timeoutMs
      );

      const choice = response.choices?.[0];
      const answer = extractAnswerContent(choice?.message?.content);

      if (!answer) {
        throw new Error("Mistral returned an empty chat completion");
      }

      return {
        answer,
        model: response.model ?? model,
        usage: response.usage
          ? {
              promptTokens: response.usage.promptTokens ?? 0,
              completionTokens: response.usage.completionTokens ?? 0,
              totalTokens: response.usage.totalTokens ?? 0,
            }
          : undefined,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES && isRetryableMistralError(err)) {
        const delay = RETRY_BASE_DELAY_MS * attempt;
        console.warn(
          `[aiService] Chat retry ${attempt}/${MAX_RETRIES} after ${delay}ms:`,
          lastError.message
        );
        await sleep(delay);
        continue;
      }

      if (lastError.message.toLowerCase().includes("rate limit")) {
        throw new Error(`Mistral rate limit exceeded: ${lastError.message}`);
      }

      throw new Error(`Mistral chat API failed: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error("Mistral chat completion failed");
}

/** Validate Mistral connectivity at startup (optional health check) */
export async function validateMistralConnection(): Promise<void> {
  getMistralClient();
}
