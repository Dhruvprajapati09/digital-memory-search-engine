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

interface GroqChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

async function requestGroqChatCompletion(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  signal?: AbortSignal
): Promise<GroqChatResponse> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal,
  });

  const responseText = await response.text();
  let payload: GroqChatResponse & { error?: { message?: string } };

  try {
    payload = JSON.parse(responseText) as GroqChatResponse & {
      error?: { message?: string };
    };
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const providerMessage = payload.error?.message || responseText || response.statusText;
    throw new Error(`Groq API ${response.status}: ${providerMessage}`);
  }

  return payload;
}

/**
 * Generate a chat completion using Groq.
 * Used by the RAG pipeline to produce grounded answers from retrieved context.
 */
export async function generateChatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const model = options?.model ?? env.GROQ_CHAT_MODEL;
  const temperature = options?.temperature ?? env.GROQ_CHAT_TEMPERATURE;
  const maxTokens = options?.maxTokens ?? env.MAX_OUTPUT_TOKENS;
  const timeoutMs = env.AI_REQUEST_TIMEOUT_MS;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await withTimeout(
        requestGroqChatCompletion(
          messages,
          model,
          temperature,
          maxTokens,
          options?.signal
        ),
        timeoutMs
      );

      const choice = response.choices?.[0];
      const answer = extractAnswerContent(choice?.message?.content);

      if (!answer) {
        throw new Error("Groq returned an empty chat completion");
      }

      return {
        answer,
        model: response.model ?? model,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens ?? 0,
              completionTokens: response.usage.completion_tokens ?? 0,
              totalTokens: response.usage.total_tokens ?? 0,
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
        throw new Error(`Groq rate limit exceeded: ${lastError.message}`);
      }

      throw new Error(`Groq chat API failed: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error("Groq chat completion failed");
}

/** Validate Mistral connectivity at startup (optional health check) */
export async function validateMistralConnection(): Promise<void> {
  getMistralClient();
}
