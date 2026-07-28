import { describe, expect, it } from "vitest";
import { resolveSearchV2Strategy } from "../retrievalStrategyService";
import type { QueryPipelineResult } from "../../../types/query";
import type {
  SearchV2QueryRewrite,
  SearchV2SemanticFilters,
} from "../../../types/searchV2";

function baseAnalysis(overrides?: Partial<QueryPipelineResult>): QueryPipelineResult {
  return {
    original: "react hooks",
    normalized: "react hooks",
    intent: "search",
    confidence: 0.7,
    entities: [],
    keywords: ["react", "hooks"],
    expandedTerms: [],
    metadataHints: {},
    ...overrides,
  };
}

function baseRewrite(query: string): SearchV2QueryRewrite {
  return {
    originalQuery: query,
    normalizedQuery: query,
    correctedQuery: query,
    rewrittenQuery: query,
    expansions: [],
    multiQueries: [query],
    decomposedQuestions: [],
    corrections: [],
  };
}

const noFilters: SearchV2SemanticFilters = { tags: [] };

describe("resolveSearchV2Strategy", () => {
  it("uses graph-heavy strategy for relationship queries", () => {
    const plan = resolveSearchV2Strategy(
      baseAnalysis(),
      baseRewrite("how is react related to redux"),
      noFilters
    );

    expect(plan.strategy).toBe("relationship_search");
    expect(plan.weights.graph).toBeGreaterThan(plan.weights.keyword);
  });

  it("uses metadata-heavy strategy for document navigation", () => {
    const plan = resolveSearchV2Strategy(
      baseAnalysis(),
      baseRewrite("find section about jwt auth"),
      noFilters
    );

    expect(plan.strategy).toBe("document_navigation");
    expect(plan.weights.metadata).toBeGreaterThan(plan.weights.vector);
  });

  it("respects comparison intent from the existing query pipeline", () => {
    const plan = resolveSearchV2Strategy(
      baseAnalysis({ intent: "comparison" }),
      baseRewrite("react vs vue"),
      noFilters
    );

    expect(plan.strategy).toBe("comparison");
  });
});
