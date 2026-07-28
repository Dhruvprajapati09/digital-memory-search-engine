const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "must", "shall", "can",
  "this", "that", "these", "those", "it", "its", "they", "them", "their",
  "we", "our", "you", "your", "i", "my", "me", "about", "into", "through",
  "during", "before", "after", "above", "below", "between", "under",
  "again", "further", "then", "once", "here", "there", "when", "where",
  "why", "how", "all", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
  "very", "just", "also", "now", "what", "which", "who", "whom", "find",
  "show", "tell", "explain", "give", "please",
]);

/** Simple suffix stemmer for common English endings */
function stemWord(word: string): string {
  if (word.length <= 4) return word;

  if (word.endsWith("ing") && word.length > 5) {
    return word.slice(0, -3);
  }
  if (word.endsWith("tion") && word.length > 6) {
    return word.slice(0, -4);
  }
  if (word.endsWith("ies") && word.length > 5) {
    return word.slice(0, -3) + "y";
  }
  if (word.endsWith("es") && word.length > 4) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 4) {
    return word.slice(0, -1);
  }
  if (word.endsWith("ed") && word.length > 4) {
    return word.slice(0, -2);
  }

  return word;
}

function tokenize(normalizedQuery: string): string[] {
  return normalizedQuery
    .split(/\s+/)
    .map((t) => t.replace(/[^\w\-+#./]/g, ""))
    .filter((t) => t.length >= 2);
}

/**
 * Extract meaningful keywords from a normalized query.
 */
export function extractKeywords(normalizedQuery: string): string[] {
  const tokens = tokenize(normalizedQuery);
  const keywords = new Set<string>();

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (STOP_WORDS.has(lower)) continue;
    keywords.add(stemWord(lower));
  }

  // Preserve multi-word phrases in quotes from original tokenization
  const quoted = normalizedQuery.match(/"([^"]+)"/g);
  if (quoted) {
    for (const q of quoted) {
      const phrase = q.replace(/"/g, "").trim();
      if (phrase.length >= 2) keywords.add(phrase);
    }
  }

  return [...keywords];
}

/** Terms used for retrieval expansion (includes unstemmed significant tokens) */
export function extractRetrievalTerms(
  normalizedQuery: string,
  keywords: string[]
): string[] {
  const terms = new Set<string>(keywords);

  for (const token of tokenize(normalizedQuery)) {
    const lower = token.toLowerCase();
    if (lower.length >= 2 && !STOP_WORDS.has(lower)) {
      terms.add(lower);
    }
  }

  return [...terms];
}
