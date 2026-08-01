import { env } from "../../config/env";
import type { QueryPipelineResult } from "../../types/query";
import { normalizeQueryText } from "./queryNormalizer";
import { detectIntent } from "./intentDetectionService";
import { extractKeywords } from "./keywordExtractionService";
import { extractEntities } from "./entityExtractionService";
import { expandQueryTerms } from "./queryExpansionService";
import { detectMetadataHints } from "./metadataHintService";
import { loadUserVocabulary } from "./vocabularyLoader";
import {
  filterInstructionTerms,
  isAnswerStyleToken,
  stripAnswerStylePhrases,
  stripAnswerStyleTokensFromText,
} from "./answerStyleTerms";

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

export interface ContentFocusedRetrievalTerms {
  retrievalQuery: string;
  keywords: string[];
  expandedTerms: string[];
  entities: string[];
}

/**
 * Build content-only retrieval terms for RAG (instruction words removed).
 * Keywords are order-preserving and deduped. Never returns an empty retrievalQuery.
 */
export function buildContentFocusedRetrievalTerms(
  pipeline: QueryPipelineResult
): ContentFocusedRetrievalTerms {
  const withoutPunct = pipeline.normalized.replace(/[?!.]+$/g, "").trim();
  const stripped = stripAnswerStylePhrases(withoutPunct);

  let keywords = filterInstructionTerms(extractKeywords(stripped));
  if (keywords.length === 0) {
    keywords = filterInstructionTerms(pipeline.keywords);
  }

  const expandedTerms = filterInstructionTerms(pipeline.expandedTerms);

  const entities = pipeline.entities.filter((entity) => {
    const trimmed = entity.trim();
    if (!trimmed) return false;
    // Keep multi-word content entities; drop pure instruction tokens only
    if (/\s/.test(trimmed)) return true;
    return !isAnswerStyleToken(trimmed);
  });

  let retrievalQuery = keywords.join(" ").trim();

  if (!retrievalQuery) {
    retrievalQuery = stripAnswerStyleTokensFromText(stripped);
  }
  if (!retrievalQuery) {
    retrievalQuery = stripAnswerStyleTokensFromText(
      stripAnswerStylePhrases(pipeline.original)
    );
  }
  if (!retrievalQuery) {
    retrievalQuery = pipeline.original.trim() || pipeline.normalized.trim();
  }
  if (!retrievalQuery) {
    retrievalQuery = "search";
  }

  return {
    retrievalQuery,
    keywords,
    expandedTerms,
    entities,
  };
}

/**
 * Content-focused query for embedding / keyword / ranking (RAG).
 * Never returns an empty string.
 */
export function buildRetrievalQuery(pipeline: QueryPipelineResult): string {
  return buildContentFocusedRetrievalTerms(pipeline).retrievalQuery;
}
