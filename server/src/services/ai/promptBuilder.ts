import { env } from "../../config/env";
import { sanitizeUserInput } from "../../utils/markdown";
import type { ChatMessage } from "../../types/ai";

export const NO_ANSWER_MESSAGE =
  "I couldn't find that information in your saved documents.";

const SYSTEM_PROMPT = `You are an AI Memory Assistant that helps users recall information from their saved documents.

Rules:
- Answer ONLY using the provided context from the user's indexed documents.
- If the answer cannot be found in the context, respond exactly with: "${NO_ANSWER_MESSAGE}"
- Never invent, assume, or supplement with outside knowledge.
- Always cite which document or section your answer comes from.
- When citing a video, include the timestamp and video title.
- Use markdown formatting.
- Use bullet lists when listing multiple points.
- Use headings when the answer covers multiple topics.
- Keep answers concise and focused on the user's question.
- Do not mention that you are an AI unless directly asked.`;

/**
 * Validate and sanitize a user question before retrieval or LLM calls.
 */
export function validateQuestion(question: unknown): string {
  if (typeof question !== "string") {
    throw new QuestionValidationError("Question is required", 400);
  }

  const sanitized = sanitizeUserInput(question);

  if (!sanitized) {
    throw new QuestionValidationError("Question cannot be empty", 400);
  }

  if (sanitized.length > env.AI_MAX_QUESTION_LENGTH) {
    throw new QuestionValidationError(
      `Question must be at most ${env.AI_MAX_QUESTION_LENGTH} characters`,
      400
    );
  }

  return sanitized;
}

export class QuestionValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "QuestionValidationError";
    this.statusCode = statusCode;
  }
}

/**
 * Build the system prompt for grounded answer generation.
 */
export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

/**
 * Build the user prompt combining retrieved context and the question.
 */
export function buildUserPrompt(question: string, context: string): string {
  return `Context from the user's saved documents:

${context}

---

Question: ${question}

Answer using only the context above. Cite document names when referencing specific information.`;
}

/**
 * Build the full message array for chat completion.
 */
export function buildAnswerMessages(
  question: string,
  context: string
): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(question, context) },
  ];
}

const SUMMARY_SYSTEM_PROMPT = `You are an AI Memory Assistant that summarizes documents from a user's personal knowledge base.

Rules:
- Summarize ONLY using the provided document content.
- Be accurate and do not invent information.
- Return valid JSON with no markdown fences or extra text.
- Use this exact JSON shape:
{
  "summary": "2-4 sentence overview",
  "topics": ["main topic 1", "main topic 2"],
  "keywords": ["key term 1", "key term 2"],
  "concepts": ["important concept 1"],
  "highlights": ["bullet highlight 1", "bullet highlight 2"]
}`;

/**
 * Build messages for document summarization.
 */
export function buildSummaryMessages(
  documentTitle: string,
  context: string
): ChatMessage[] {
  return [
    { role: "system", content: SUMMARY_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Summarize the following document titled "${documentTitle}":

${context}

Return JSON only.`,
    },
  ];
}
