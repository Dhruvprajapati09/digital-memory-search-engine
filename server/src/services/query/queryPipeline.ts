import { env } from "../../config/env";
import type { QueryPipelineResult } from "../../types/query";
import { normalizeQueryText } from "./queryNormalizer";
import { detectIntent } from "./intentDetectionService";
import { extractKeywords } from "./keywordExtractionService";
import { extractEntities } from "./entityExtractionService";
import { expandQueryTerms } from "./queryExpansionService";
import { detectMetadataHints } from "./metadataHintService";
import { loadUserVocabulary } from "./vocabularyLoader";

export interface QueryPipelineOptions {
  userId?: string;
  skipVocabulary?: boolean;
}

/**
 * Full query intelligence pipeline (Phase 2).
 * Deterministic — no LLM calls.
 */
export async function runQueryPipeline(
  query: string,
  options?: QueryPipelineOptions
): Promise<QueryPipelineResult> {
  const { original, normalized } = normalizeQueryText(query);

  const { intent, confidence: intentConfidence } = detectIntent(normalized);
  const keywords = extractKeywords(normalized);

  let vocabulary;
  if (options?.userId && !options.skipVocabulary) {
    vocabulary = await loadUserVocabulary(options.userId);
  }

  const entities =
    env.ENABLE_ENTITY_EXTRACTION && options?.userId
      ? extractEntities({
          normalizedQuery: normalized,
          vocabulary: vocabulary
            ? {
                concepts: vocabulary.concepts,
                keywords: vocabulary.keywords,
                documentTitles: vocabulary.documentTitles,
              }
            : undefined,
        })
      : extractEntities({ normalizedQuery: normalized });

  const expandedTerms =
    env.ENABLE_QUERY_EXPANSION
      ? expandQueryTerms({
          keywords,
          entities,
          vocabulary: vocabulary
            ? {
                keywords: vocabulary.keywords,
                concepts: vocabulary.concepts,
                tags: vocabulary.tags,
              }
            : undefined,
          limit: env.QUERY_EXPANSION_LIMIT,
        })
      : [...keywords];

  const metadataHints =
    env.ENABLE_METADATA_HINTS && options?.userId
      ? detectMetadataHints(normalized, entities, keywords, vocabulary)
      : detectMetadataHints(normalized, entities, keywords);

  return {
    original,
    normalized,
    intent,
    confidence: intentConfidence,
    entities,
    keywords,
    expandedTerms,
    metadataHints,
  };
}

/** Ranking query string combining normalized + keywords + expansion */
export function buildRankingQuery(pipeline: QueryPipelineResult): string {
  const terms = new Set([
    pipeline.normalized,
    ...pipeline.keywords,
    ...pipeline.expandedTerms,
    ...pipeline.entities.map((e) => e.toLowerCase()),
  ]);
  return [...terms].join(" ");
}
