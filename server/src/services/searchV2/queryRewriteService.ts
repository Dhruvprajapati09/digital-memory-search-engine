import { normalizeQueryText } from "../query/queryNormalizer";
import { extractKeywords } from "../query/keywordExtractionService";
import { extractEntities } from "../query/entityExtractionService";
import { expandQueryTerms } from "../query/queryExpansionService";
import { loadUserVocabulary } from "../query/vocabularyLoader";
import {
  STATIC_PHRASE_CORRECTIONS,
  STATIC_SPELLING_DICTIONARY,
  correctQuerySpelling,
} from "../query/spellCorrectionService";
import type { SearchV2QueryRewrite } from "../../types/searchV2";

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
  // Static dictionary only — SearchV2 behavior unchanged (no user-vocab primary)
  const { correctedQuery, corrections } = correctQuerySpelling(normalized, {
    primaryDictionary: [],
    fallbackDictionary: STATIC_SPELLING_DICTIONARY,
    phraseCorrections: STATIC_PHRASE_CORRECTIONS,
    minTokenLength: 5,
  });
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
