import { describe, expect, it } from "vitest";
import {
  buildGraphSeedTerms,
  calculateGraphConfidence,
  normalizeGraphLabel,
} from "../graphRetrievalService";
import type { QueryPipelineResult } from "../../../types/query";

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
});
