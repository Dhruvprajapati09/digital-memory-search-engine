/**
 * Lightweight dictionary spell correction for queries.
 * RAG uses vocab-first then static fallback; SearchV2 uses static only.
 */

import type { UserVocabulary } from "../../types/query";

/** Static technical terms (SearchV2 parity + RAG fallback) */
export const STATIC_SPELLING_DICTIONARY: readonly string[] = [
  "authentication",
  "authorization",
  "javascript",
  "typescript",
  "mongodb",
  "postgresql",
  "kubernetes",
  "docker",
  "embedding",
  "retrieval",
  "reranking",
  "middleware",
  "component",
  "function",
  "database",
  "schema",
  "indexing",
  "performance",
  "configuration",
];

export const STATIC_PHRASE_CORRECTIONS: Readonly<Record<string, string>> = {
  "mongo db": "mongodb",
  nodejs: "node.js",
  "node js": "node.js",
  reactjs: "react",
  "jwt auth": "jwt authentication",
  "auth jwt": "jwt authentication",
};

export interface SpellingDictionaries {
  primaryDictionary: string[];
  fallbackDictionary: string[];
  phraseCorrections: Readonly<Record<string, string>>;
}

export interface SpellCorrectionOptions {
  primaryDictionary?: readonly string[];
  fallbackDictionary?: readonly string[];
  phraseCorrections?: Readonly<Record<string, string>>;
  /** Default 4 for RAG; SearchV2 can pass 5 for prior behavior */
  minTokenLength?: number;
}

export interface SpellCorrectionResult {
  correctedQuery: string;
  corrections: Array<{ from: string; to: string }>;
}

export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function uniqueLowercase(terms: Iterable<string>, minLen = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const term of terms) {
    const lower = term.trim().toLowerCase();
    if (lower.length < minLen || seen.has(lower)) continue;
    seen.add(lower);
    out.push(lower);
  }

  return out;
}

function tokenizeTitle(title: string): string[] {
  return title
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

/**
 * Build primary (user vocab) + fallback (static) dictionaries.
 */
export function buildSpellingDictionaries(
  vocab?: UserVocabulary
): SpellingDictionaries {
  const primary: string[] = [];

  if (vocab) {
    primary.push(...vocab.keywords);
    primary.push(...vocab.concepts);
    primary.push(...vocab.tags);
    for (const title of vocab.documentTitles) {
      primary.push(...tokenizeTitle(title));
    }
  }

  const fallback = uniqueLowercase([
    ...STATIC_SPELLING_DICTIONARY,
    ...Object.values(STATIC_PHRASE_CORRECTIONS),
  ]);

  return {
    primaryDictionary: uniqueLowercase(primary),
    fallbackDictionary: fallback,
    phraseCorrections: STATIC_PHRASE_CORRECTIONS,
  };
}

function distanceThreshold(tokenLength: number): number {
  return tokenLength <= 7 ? 1 : 2;
}

/**
 * Best candidate in dictionary within edit-distance threshold.
 * Prefers same first letter; then lower distance; then longer candidate.
 */
export function findBestCorrection(
  token: string,
  dictionary: readonly string[]
): string | null {
  const lower = token.toLowerCase();
  if (dictionary.includes(lower)) return null;

  const threshold = distanceThreshold(lower.length);
  let best: string | null = null;
  let bestDistance = Number.MAX_SAFE_INTEGER;
  let bestSameFirst = false;

  for (const candidate of dictionary) {
    if (Math.abs(candidate.length - lower.length) > threshold) continue;

    const distance = editDistance(lower, candidate);
    if (distance === 0 || distance > threshold) continue;

    const sameFirst =
      candidate.length > 0 &&
      lower.length > 0 &&
      candidate[0] === lower[0];

    const better =
      best === null ||
      distance < bestDistance ||
      (distance === bestDistance && sameFirst && !bestSameFirst) ||
      (distance === bestDistance &&
        sameFirst === bestSameFirst &&
        candidate.length > (best?.length ?? 0));

    if (better) {
      best = candidate;
      bestDistance = distance;
      bestSameFirst = sameFirst;
    }
  }

  return best;
}

/**
 * Correct query tokens: primary dictionary first, then fallback.
 */
export function correctQuerySpelling(
  normalizedQuery: string,
  options: SpellCorrectionOptions = {}
): SpellCorrectionResult {
  const primary = options.primaryDictionary ?? [];
  const fallback =
    options.fallbackDictionary ?? STATIC_SPELLING_DICTIONARY;
  const phraseCorrections =
    options.phraseCorrections ?? STATIC_PHRASE_CORRECTIONS;
  const minTokenLength = options.minTokenLength ?? 4;

  let correctedQuery = normalizedQuery.trim().replace(/\s+/g, " ");
  if (!correctedQuery) {
    return { correctedQuery: normalizedQuery, corrections: [] };
  }

  const corrections: Array<{ from: string; to: string }> = [];

  for (const [from, to] of Object.entries(phraseCorrections)) {
    const pattern = new RegExp(
      `\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`,
      "i"
    );
    if (pattern.test(correctedQuery)) {
      correctedQuery = correctedQuery.replace(pattern, to);
      if (from !== to) corrections.push({ from, to });
    }
  }

  const tokens = correctedQuery.split(/\s+/);
  const correctedTokens = tokens.map((token) => {
    const clean = token.replace(/[^\w.-]/g, "");
    if (clean.length < minTokenLength) return token;

    const fromPrimary = findBestCorrection(clean, primary);
    const best =
      fromPrimary ?? findBestCorrection(clean, fallback);

    if (!best) return token;

    const lowerClean = clean.toLowerCase();
    if (best === lowerClean) return token;

    corrections.push({ from: clean, to: best });
    return token.replace(clean, best);
  });

  const joined = correctedTokens.join(" ").replace(/\s+/g, " ").trim();

  return {
    correctedQuery: joined || normalizedQuery.trim() || "search",
    corrections,
  };
}
