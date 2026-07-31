export type MatchMode = "phrase" | "keyword";

export interface MatchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  prefix?: boolean;
  /** phrase = contiguous query; keyword = all tokens on the page */
  matchMode?: MatchMode;
}

export interface TextOccurrence {
  start: number;
  end: number;
  matchedText: string;
}

export interface PageMatchResult {
  occurrenceCount: number;
  occurrences: TextOccurrence[];
  /** First occurrence matched text (source casing) */
  matchQuote?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeQueryWhitespace(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

export function tokenizeSearchQuery(query: string): string[] {
  return normalizeQueryWhitespace(query)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function buildTermPattern(
  term: string,
  options: Required<Pick<MatchOptions, "caseSensitive" | "wholeWord" | "prefix">>
): RegExp {
  const escaped = escapeRegExp(term);
  const body = options.prefix ? `${escaped}\\w*` : escaped;
  const source = options.wholeWord ? `\\b${body}\\b` : body;
  return new RegExp(source, options.caseSensitive ? "g" : "gi");
}

function findRegexOccurrences(text: string, pattern: RegExp): TextOccurrence[] {
  const occurrences: TextOccurrence[] = [];
  // Ensure global flag for iterative exec
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const global = new RegExp(pattern.source, flags);
  let match: RegExpExecArray | null;

  while ((match = global.exec(text)) !== null) {
    if (match[0].length === 0) {
      global.lastIndex += 1;
      continue;
    }

    occurrences.push({
      start: match.index,
      end: match.index + match[0].length,
      matchedText: match[0],
    });

    if (global.lastIndex === match.index) {
      global.lastIndex += 1;
    }
  }

  return occurrences;
}

/**
 * Find all occurrences of a query in page text with Ctrl+F-style options.
 */
export function findMatchesInText(
  text: string,
  query: string,
  options: MatchOptions = {}
): PageMatchResult {
  const normalizedQuery = normalizeQueryWhitespace(query);
  if (!normalizedQuery || !text) {
    return { occurrenceCount: 0, occurrences: [] };
  }

  const caseSensitive = options.caseSensitive ?? false;
  const wholeWord = options.wholeWord ?? false;
  const prefix = options.prefix ?? false;
  const tokens = tokenizeSearchQuery(normalizedQuery);
  const matchMode: MatchMode =
    options.matchMode ?? (tokens.length > 1 ? "phrase" : "keyword");

  const flags = { caseSensitive, wholeWord, prefix };

  if (matchMode === "phrase" || tokens.length === 1) {
    const pattern = buildTermPattern(normalizedQuery, flags);
    const occurrences = findRegexOccurrences(text, pattern);
    return {
      occurrenceCount: occurrences.length,
      occurrences,
      matchQuote: occurrences[0]?.matchedText,
    };
  }

  // Keyword mode: every token must appear at least once on the page.
  // Count = sum of all token occurrences (multi-match detection).
  const allOccurrences: TextOccurrence[] = [];

  for (const token of tokens) {
    const pattern = buildTermPattern(token, flags);
    const hits = findRegexOccurrences(text, pattern);
    if (hits.length === 0) {
      return { occurrenceCount: 0, occurrences: [] };
    }
    allOccurrences.push(...hits);
  }

  allOccurrences.sort((a, b) => a.start - b.start);

  return {
    occurrenceCount: allOccurrences.length,
    occurrences: allOccurrences,
    matchQuote: allOccurrences[0]?.matchedText,
  };
}

/** Build a preview snippet centered on the first match. */
export function buildMatchSnippet(
  text: string,
  occurrence: TextOccurrence | undefined,
  maxLength = 280
): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  if (!occurrence || normalized.length <= maxLength) {
    return normalized.length <= maxLength
      ? normalized
      : `${normalized.slice(0, maxLength).trim()}...`;
  }

  // Map occurrence offsets from original text roughly onto collapsed whitespace text
  // by searching for the matched quote in the normalized string.
  const quote = occurrence.matchedText.replace(/\s+/g, " ");
  const lowerNorm = normalized.toLowerCase();
  const lowerQuote = quote.toLowerCase();
  let anchor = lowerNorm.indexOf(lowerQuote);
  if (anchor < 0) {
    anchor = Math.min(occurrence.start, Math.max(0, normalized.length - 1));
  }

  const half = Math.floor(maxLength / 2);
  let start = Math.max(0, anchor - half);
  let end = Math.min(normalized.length, start + maxLength);
  if (end - start < maxLength) {
    start = Math.max(0, end - maxLength);
  }

  let snippet = normalized.slice(start, end).trim();
  if (start > 0) snippet = `...${snippet}`;
  if (end < normalized.length) snippet = `${snippet}...`;
  return snippet;
}

/** Terms to highlight in the UI preview. */
export function buildHighlightTerms(
  query: string,
  options: MatchOptions = {}
): string[] {
  const normalized = normalizeQueryWhitespace(query);
  if (!normalized) return [];

  const tokens = tokenizeSearchQuery(normalized);
  const matchMode: MatchMode =
    options.matchMode ?? (tokens.length > 1 ? "phrase" : "keyword");

  if (matchMode === "phrase") {
    return [normalized, ...tokens.filter((t) => t.length >= 2)];
  }

  return tokens.filter((t) => t.length >= 1);
}
