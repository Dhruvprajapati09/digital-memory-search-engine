import { describe, expect, it } from "vitest";
import {
  buildGraphCacheKey,
  buildGraphSeedTerms,
  calculateGraphConfidence,
  getGraphRetrievalCacheSize,
  normalizeGraphLabel,
  resetGraphRetrievalCache,
  type GraphRetrievalOptions,
} from "../graphRetrievalService";
import type { QueryPipelineResult } from "../../../types/query";

function analysis(
  partial: Partial<QueryPipelineResult> &
    Pick<QueryPipelineResult, "normalized" | "keywords">
): QueryPipelineResult {
  return {
    original: partial.original ?? partial.normalized,
    intent: "search",
    confidence: 1,
    entities: [],
    expandedTerms: [],
    metadataHints: {},
    ...partial,
  };
}

describe("graphRetrievalService helpers", () => {
  it("normalizes graph labels for matching", () => {
    expect(normalizeGraphLabel("  React Hooks: useMemo()  ")).toBe(
      "react hooks usememo"
    );
  });

  it("builds bounded seed terms from query intelligence", () => {
    const queryAnalysis: QueryPipelineResult = {
      original: "Find React hooks",
      normalized: "find react hooks",
      intent: "search",
      confidence: 0.8,
      entities: ["React"],
      keywords: ["hooks", "memoization"],
      expandedTerms: ["useMemo", "useCallback"],
      metadataHints: {
        topic: "React Hooks",
        tags: [],
      },
    };

    const terms = buildGraphSeedTerms(queryAnalysis);

    expect(terms).toContain("react");
    expect(terms).toContain("react hooks");
    expect(terms).toContain("memoization");
    expect(terms.length).toBeLessThanOrEqual(32);
  });

  it("penalizes confidence for distant traversal matches", () => {
    const direct = calculateGraphConfidence(0.8, 2, 0);
    const distant = calculateGraphConfidence(0.8, 2, 2);

    expect(direct).toBeGreaterThan(distant);
    expect(direct).toBeLessThanOrEqual(1);
    expect(distant).toBeGreaterThan(0);
  });

  it("strengthens cache key with expandedTerms and sorted fields", () => {
    const base: GraphRetrievalOptions = {
      userId: "user-1",
      queryAnalysis: analysis({
        normalized: "hidden markov model",
        keywords: ["model", "markov"],
        expandedTerms: ["chain", "hmm"],
        entities: ["Markov"],
        metadataHints: { topic: "ml" },
      }),
      limit: 10,
      maxDepth: 2,
    };

    const keyA = buildGraphCacheKey(base);
    const keyB = buildGraphCacheKey({
      ...base,
      queryAnalysis: {
        ...base.queryAnalysis,
        expandedTerms: ["hmm", "chain"],
        keywords: ["markov", "model"],
      },
    });
    const keyC = buildGraphCacheKey({
      ...base,
      queryAnalysis: {
        ...base.queryAnalysis,
        expandedTerms: ["different"],
      },
    });

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
    expect(keyA).toContain("expandedTerms");
  });

  it("starts with an empty graph cache after reset (empty misses are not retained)", () => {
    resetGraphRetrievalCache();
    expect(getGraphRetrievalCacheSize()).toBe(0);
  });
});
