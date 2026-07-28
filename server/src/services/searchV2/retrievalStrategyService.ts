import type { QueryPipelineResult } from "../../types/query";
import type {
  SearchV2QueryRewrite,
  SearchV2SemanticFilters,
  SearchV2Strategy,
  SearchV2StrategyPlan,
  SearchV2Weights,
} from "../../types/searchV2";

const BASE_WEIGHTS: SearchV2Weights = {
  vector: 0.28,
  keyword: 0.2,
  metadata: 0.12,
  graph: 0.12,
  recency: 0.05,
  crossEncoder: 0.18,
  popularity: 0.02,
  freshness: 0.03,
};

const STRATEGY_WEIGHTS: Record<SearchV2Strategy, Partial<SearchV2Weights>> = {
  fact_lookup: { keyword: 0.26, metadata: 0.16, crossEncoder: 0.22 },
  definition: { vector: 0.32, crossEncoder: 0.22, keyword: 0.18 },
  comparison: { vector: 0.3, graph: 0.18, crossEncoder: 0.22 },
  summarization: { vector: 0.34, metadata: 0.14, recency: 0.08 },
  code_search: { keyword: 0.3, metadata: 0.16, vector: 0.22 },
  document_navigation: { metadata: 0.28, keyword: 0.24, vector: 0.16 },
  question_answering: { vector: 0.32, crossEncoder: 0.25, graph: 0.14 },
  entity_search: { graph: 0.25, keyword: 0.22, metadata: 0.16 },
  topic_search: { vector: 0.3, metadata: 0.18, graph: 0.16 },
  timeline_search: { recency: 0.18, freshness: 0.14, metadata: 0.16 },
  relationship_search: { graph: 0.32, vector: 0.24, crossEncoder: 0.2 },
  general_search: BASE_WEIGHTS,
};

function normalizeWeights(weights: SearchV2Weights): SearchV2Weights {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return BASE_WEIGHTS;

  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value / total])
  ) as unknown as SearchV2Weights;
}

function weightsFor(strategy: SearchV2Strategy): SearchV2Weights {
  return normalizeWeights({
    ...BASE_WEIGHTS,
    ...STRATEGY_WEIGHTS[strategy],
  });
}

function detectStrategy(
  queryAnalysis: QueryPipelineResult,
  rewrite: SearchV2QueryRewrite,
  semanticFilters: SearchV2SemanticFilters
): { strategy: SearchV2Strategy; reasons: string[]; confidence: number } {
  const query = rewrite.correctedQuery;
  const reasons: string[] = [];

  if (/\b(before|after|timeline|history|when|chronolog|recent)\b/i.test(query)) {
    reasons.push("Temporal language detected");
    return { strategy: "timeline_search", reasons, confidence: 0.82 };
  }

  if (/\b(relationship|related to|connected to|depends on|uses|between)\b/i.test(query)) {
    reasons.push("Relationship language detected");
    return { strategy: "relationship_search", reasons, confidence: 0.84 };
  }

  if (/\b(page|chapter|section|heading|where|locate|find in)\b/i.test(query)) {
    reasons.push("Document navigation language detected");
    return { strategy: "document_navigation", reasons, confidence: 0.8 };
  }

  if (/\b(code|function|class|interface|api|endpoint|syntax|snippet)\b/i.test(query)) {
    reasons.push("Code/API language detected");
    return { strategy: "code_search", reasons, confidence: 0.82 };
  }

  if (queryAnalysis.intent === "comparison") {
    reasons.push("Comparison intent from query pipeline");
    return { strategy: "comparison", reasons, confidence: queryAnalysis.confidence };
  }

  if (queryAnalysis.intent === "summary") {
    reasons.push("Summarization intent from query pipeline");
    return { strategy: "summarization", reasons, confidence: queryAnalysis.confidence };
  }

  if (queryAnalysis.intent === "definition") {
    reasons.push("Definition intent from query pipeline");
    return { strategy: "definition", reasons, confidence: queryAnalysis.confidence };
  }

  if (query.endsWith("?") || queryAnalysis.intent === "question") {
    reasons.push("Question-answering intent detected");
    return { strategy: "question_answering", reasons, confidence: 0.76 };
  }

  if (semanticFilters.entity || queryAnalysis.entities.length > 0) {
    reasons.push("Entity signal detected");
    return { strategy: "entity_search", reasons, confidence: 0.72 };
  }

  if (semanticFilters.topic || queryAnalysis.metadataHints.topic) {
    reasons.push("Topic signal detected");
    return { strategy: "topic_search", reasons, confidence: 0.68 };
  }

  reasons.push("Using balanced general search strategy");
  return { strategy: "general_search", reasons, confidence: 0.6 };
}

function candidateMultiplierFor(strategy: SearchV2Strategy): number {
  switch (strategy) {
    case "comparison":
    case "summarization":
    case "relationship_search":
      return 10;
    case "question_answering":
    case "topic_search":
      return 8;
    case "fact_lookup":
    case "document_navigation":
      return 5;
    default:
      return 6;
  }
}

function contextWindowFor(strategy: SearchV2Strategy): number {
  switch (strategy) {
    case "summarization":
    case "comparison":
      return 16;
    case "question_answering":
    case "relationship_search":
      return 12;
    case "fact_lookup":
    case "document_navigation":
      return 6;
    default:
      return 10;
  }
}

export function resolveSearchV2Strategy(
  queryAnalysis: QueryPipelineResult,
  rewrite: SearchV2QueryRewrite,
  semanticFilters: SearchV2SemanticFilters
): SearchV2StrategyPlan {
  const detected = detectStrategy(queryAnalysis, rewrite, semanticFilters);

  return {
    strategy: detected.strategy,
    confidence: detected.confidence,
    weights: weightsFor(detected.strategy),
    candidateMultiplier: candidateMultiplierFor(detected.strategy),
    contextWindow: contextWindowFor(detected.strategy),
    reasons: detected.reasons,
  };
}
