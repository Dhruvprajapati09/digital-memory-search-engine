import type { QueryNormalizationResult } from "../../types/query";

/** Normalize unicode (ligatures, full-width chars) */
function normalizeUnicode(text: string): string {
  return text.normalize("NFKC");
}

/** Collapse repeated punctuation/symbols e.g. "???" → "?" */
function collapseRepeatedSymbols(text: string): string {
  return text.replace(/([?!.,;:\-_*#]){2,}/g, "$1");
}

/** Normalize curly/smart quotes to straight quotes */
function normalizeQuotes(text: string): string {
  return text
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"');
}

/** Light punctuation cleanup — keep word chars, spaces, hyphens, quotes */
function cleanupPunctuation(text: string): string {
  return text
    .replace(/[^\w\s\-'"./?#@+]/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/**
 * Deterministic query normalization for retrieval.
 */
export function normalizeQueryText(query: string): QueryNormalizationResult {
  const original = query;

  let normalized = normalizeUnicode(original);
  normalized = normalizeQuotes(normalized);
  normalized = normalized.trim().toLowerCase();
  normalized = normalized.replace(/\s+/g, " ");
  normalized = collapseRepeatedSymbols(normalized);
  normalized = cleanupPunctuation(normalized);
  normalized = normalized.replace(/\s+/g, " ").trim();

  return { original, normalized };
}
