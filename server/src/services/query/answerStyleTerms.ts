/**
 * Strip answer-style instruction phrases/tokens from text for RAG retrieval.
 * Imports the shared config so ResponsePlan and cleanup stay aligned.
 */

import {
  ANSWER_STYLE_PHRASE_SET,
  ANSWER_STYLE_PHRASES,
  ANSWER_STYLE_TOKEN_SET,
  cueToPattern,
} from "../ai/answerStyleConfig";

/**
 * Remove multi-word instruction phrases (longest first), collapse whitespace.
 */
export function stripAnswerStylePhrases(text: string): string {
  let result = text;
  for (const phrase of ANSWER_STYLE_PHRASES) {
    result = result.replace(cueToPattern(phrase), " ");
  }
  return result.replace(/\s+/g, " ").trim();
}

export function isAnswerStyleToken(token: string): boolean {
  const lower = token.trim().toLowerCase();
  if (!lower) return false;
  if (ANSWER_STYLE_TOKEN_SET.has(lower)) return true;
  if (ANSWER_STYLE_PHRASE_SET.has(lower)) return true;
  return false;
}

/**
 * Drop instruction terms only; preserve first-seen order; dedupe case-insensitively.
 */
export function filterInstructionTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed) continue;
    if (isAnswerStyleToken(trimmed)) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }

  return out;
}

/**
 * Remove instruction tokens from free text while keeping content words (order preserved).
 */
export function stripAnswerStyleTokensFromText(text: string): string {
  const parts = text
    .split(/\s+/)
    .map((t) => t.replace(/[?!.]+$/g, ""))
    .filter(Boolean);

  return filterInstructionTerms(parts).join(" ").trim();
}
