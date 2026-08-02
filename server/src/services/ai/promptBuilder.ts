import { env } from "../../config/env";
import { sanitizeUserInput } from "../../utils/markdown";
import type { ChatMessage } from "../../types/ai";
import {
  composeSystemPrompt,
  NO_ANSWER_MESSAGE,
} from "./responseInstructionBlocks";
import {
  DEFAULT_RESPONSE_PLAN,
  type ResponsePlan,
} from "./responsePlan";

export { NO_ANSWER_MESSAGE };

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
 * Composes reusable grounding + style + length + format blocks.
 */
export function buildSystemPrompt(plan?: ResponsePlan): string {
  return composeSystemPrompt(plan ?? DEFAULT_RESPONSE_PLAN);
}

/**
 * Build the user prompt combining retrieved context and the question.
 */
export function buildUserPrompt(question: string, context: string): string {
  return `Context from the user's saved documents:

${context}

---

Question: ${question}

Answer using only the context above. Answer the question directly first, then explain as needed. For concept questions, open with a clear definition; otherwise adapt to intent. Write in a natural, teacher-like style; synthesize (do not copy sentences); do not repeat overlapping facts; use the smallest useful structure. Prefer short paragraphs; bullets only when helpful; tables only for comparisons; code blocks only for code that exists in the context and helps. If context is incomplete, say what the documents support — do not pretend completeness. Never mention filenames in the body or start with "According to…". Concise by default unless the question asks for more detail. Put filenames in one Sources section at the end (deduplicate; include pages when present). Never use numeric labels like "Source 1".`;
}

/**
 * Build the full message array for chat completion.
 * Optional prior turns (same conversation) are inserted after the system prompt.
 */
export function buildAnswerMessages(
  question: string,
  context: string,
  priorMessages?: Array<{ role: "user" | "assistant"; content: string }>,
  plan?: ResponsePlan
): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(plan) },
  ];

  if (priorMessages?.length) {
    for (const prior of priorMessages) {
      if (
        (prior.role === "user" || prior.role === "assistant") &&
        typeof prior.content === "string" &&
        prior.content.trim()
      ) {
        messages.push({
          role: prior.role,
          content: prior.content.trim(),
        });
      }
    }
  }

  messages.push({
    role: "user",
    content: buildUserPrompt(question, context),
  });

  return messages;
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
