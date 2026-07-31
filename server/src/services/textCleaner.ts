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

function shouldPreserveLineBreak(current: string, next: string): boolean {
  const trimmed = current.trim();
  const nextTrimmed = next.trim();

  if (!trimmed || !nextTrimmed) return true;
  if (/^#{1,6}\s+/.test(trimmed) || /^#{1,6}\s+/.test(nextTrimmed)) return true;
  if (/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(trimmed)) return true;
  if (/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(nextTrimmed)) return true;
  if (/^\s*\|.+\|\s*$/.test(trimmed) || /^\s*\|.+\|\s*$/.test(nextTrimmed)) {
    return true;
  }
  if (/^\s*```/.test(trimmed) || /^\s*```/.test(nextTrimmed)) return true;
  if (/[.!?:;)"'\]]$/.test(trimmed)) return true;
  if (/^[A-Z0-9][A-Z0-9\s/&:-]{2,80}$/.test(trimmed)) return true;
  if (/^[A-Z][\w\s/&:-]{2,80}$/.test(nextTrimmed) && !/[a-z]/.test(nextTrimmed.slice(1))) {
    return true;
  }

  return false;
}

/**
 * OCR/PDF extractors often wrap one sentence across many physical lines.
 * Merge only obvious wrapped prose lines and preserve structural line breaks.
 */
export function repairWrappedLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const repaired: string[] = [];

  for (const line of lines) {
    const current = line.trimEnd();
    const previous = repaired[repaired.length - 1];

    if (
      previous !== undefined &&
      current.trim() &&
      !shouldPreserveLineBreak(previous, current)
    ) {
      repaired[repaired.length - 1] = `${previous.trimEnd()} ${current.trimStart()}`;
    } else {
      repaired.push(current);
    }
  }

  return repaired.join("\n");
}

/** Normalize unicode characters (e.g. ligatures, full-width chars) */
export function normalizeUnicode(text: string): string {
  return text.normalize("NFKC");
}

/** Full cleaning pipeline applied to all extracted text */
export function cleanText(text: string): string {
  let cleaned = normalizeUnicode(text);
  cleaned = removeExtraSpaces(cleaned);
  cleaned = repairWrappedLines(cleaned);
  cleaned = removeRepeatedNewLines(cleaned);
  return cleaned.trim();
}
