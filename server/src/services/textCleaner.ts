/**
 * Normalizes extracted text before saving to MongoDB.
 * Keeps line breaks meaningful while removing OCR/PDF noise.
 */

/** Collapse multiple spaces/tabs on the same line into a single space */
export function removeExtraSpaces(text: string): string {
  return text.replace(/[^\S\n]+/g, " ");
}

/** Limit consecutive blank lines to a single blank line */
export function removeRepeatedNewLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n");
}

/** Normalize unicode characters (e.g. ligatures, full-width chars) */
export function normalizeUnicode(text: string): string {
  return text.normalize("NFKC");
}

/** Full cleaning pipeline applied to all extracted text */
export function cleanText(text: string): string {
  let cleaned = normalizeUnicode(text);
  cleaned = removeExtraSpaces(cleaned);
  cleaned = removeRepeatedNewLines(cleaned);
  return cleaned.trim();
}
