import { normalizeQueryText } from "../query/queryNormalizer";
import { extractKeywords } from "../query/keywordExtractionService";
import { extractEntities } from "../query/entityExtractionService";
import { expandQueryTerms } from "../query/queryExpansionService";
import { loadUserVocabulary } from "../query/vocabularyLoader";
import type { SearchV2QueryRewrite } from "../../types/searchV2";

const SPELLING_DICTIONARY = [
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

const PHRASE_CORRECTIONS: Record<string, string> = {
  "mongo db": "mongodb",
  nodejs: "node.js",
  "node js": "node.js",
  "reactjs": "react",
  "jwt auth": "jwt authentication",
  "auth jwt": "jwt authentication",
};

function editDistance(a: string, b: string): number {
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

function correctSpelling(query: string): {
  correctedQuery: string;
  corrections: Array<{ from: string; to: string }>;
} {
  let correctedQuery = query;
  const corrections: Array<{ from: string; to: string }> = [];

  for (const [from, to] of Object.entries(PHRASE_CORRECTIONS)) {
    const pattern = new RegExp(`\\b${from.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (pattern.test(correctedQuery)) {
      correctedQuery = correctedQuery.replace(pattern, to);
      if (from !== to) corrections.push({ from, to });
    }
  }

  const tokens = correctedQuery.split(/\s+/);
  const correctedTokens = tokens.map((token) => {
    const clean = token.replace(/[^\w.-]/g, "");
    if (clean.length < 5) return token;

    let best = clean;
    let bestDistance = Number.MAX_SAFE_INTEGER;

    for (const candidate of SPELLING_DICTIONARY) {
      const distance = editDistance(clean.toLowerCase(), candidate);
      const threshold = clean.length <= 7 ? 1 : 2;
      if (distance <= threshold && distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }

    if (best !== clean) {
      corrections.push({ from: clean, to: best });
      return token.replace(clean, best);
    }

    return token;
  });

  return {
    correctedQuery: correctedTokens.join(" ").replace(/\s+/g, " ").trim(),
    corrections,
  };
}

function decomposeQuestion(query: string): string[] {
  const parts = query
    .split(/\b(?:and|or|then)\b|[?;]/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8);

  return [...new Set(parts)].slice(0, 4);
}

function buildMultiQueries(
  correctedQuery: string,
  expansions: string[],
  entities: string[]
): string[] {
  const queries = new Set<string>();
  queries.add(correctedQuery);

  if (expansions.length > 0) {
    queries.add(`${correctedQuery} ${expansions.slice(0, 6).join(" ")}`);
  }

  for (const entity of entities.slice(0, 3)) {
    queries.add(`${entity} ${correctedQuery}`);
  }

  return [...queries].slice(0, 5);
}

export async function rewriteSearchQuery(
  query: string,
  userId?: string
): Promise<SearchV2QueryRewrite> {
  const { normalized } = normalizeQueryText(query);
  const { correctedQuery, corrections } = correctSpelling(normalized);
  const keywords = extractKeywords(correctedQuery);

  const vocabulary = userId ? await loadUserVocabulary(userId) : undefined;
  const entities = extractEntities({
    normalizedQuery: correctedQuery,
    vocabulary: vocabulary
      ? {
          concepts: vocabulary.concepts,
          keywords: vocabulary.keywords,
          documentTitles: vocabulary.documentTitles,
        }
      : undefined,
  });

  const expansions = expandQueryTerms({
    keywords,
    entities,
    vocabulary: vocabulary
      ? {
          keywords: vocabulary.keywords,
          concepts: vocabulary.concepts,
          tags: vocabulary.tags,
        }
      : undefined,
    limit: 24,
  }).filter((term) => !correctedQuery.includes(term));

  const rewrittenQuery = [correctedQuery, ...expansions.slice(0, 8)]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    originalQuery: query,
    normalizedQuery: normalized,
    correctedQuery,
    rewrittenQuery,
    expansions,
    multiQueries: buildMultiQueries(correctedQuery, expansions, entities),
    decomposedQuestions: decomposeQuestion(correctedQuery),
    corrections,
  };
}
