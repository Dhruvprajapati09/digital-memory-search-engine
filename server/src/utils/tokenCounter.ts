/**
 * Estimates token count for a text string.
 * Uses ~4 characters per token (common LLM rule of thumb).
 * Milestone 7 search can refine with tiktoken if needed.
 */
export function calculateTokens(text: string): number {
  if (!text.trim()) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimates tokens from word count (alternative heuristic).
 */
export function calculateTokensFromWords(wordCount: number): number {
  return Math.ceil(wordCount * 1.3);
}
