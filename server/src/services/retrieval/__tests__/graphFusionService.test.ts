import { describe, expect, it } from "vitest";
import { fuseGraphSearchResults } from "../graphFusionService";
import type { FusedSearchHit } from "../../search/hybridSearchService";
import type { GraphSearchHit } from "../graphRetrievalService";

describe("fuseGraphSearchResults", () => {
  const baseMeta = {
    documentId: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    chunkIndex: 0,
    type: "note",
  };

  it("enriches existing hybrid hits with graph scores", () => {
    const fusedHits: FusedSearchHit[] = [
      {
        vectorId: "chunk-1",
        text: "react hooks",
        metadata: baseMeta,
        vectorScore: 0.8,
        keywordScore: 0.3,
        rrfScore: 0.2,
      },
    ];

    const graphHits: GraphSearchHit[] = [
      {
        vectorId: "chunk-1",
        text: "react hooks",
        metadata: baseMeta,
        vectorScore: 0,
        keywordScore: 0,
        rrfScore: 0,
        graphScore: 0.9,
        graphConfidence: 0.82,
        graphMatchedNodes: [
          {
            nodeId: "entity:doc:react",
            type: "entity",
            label: "React",
            score: 1,
            depth: 0,
          },
        ],
      },
    ];

    const result = fuseGraphSearchResults(fusedHits, graphHits, {
      rrfK: 60,
      graphWeight: 0.25,
    });

    expect(result).toHaveLength(1);
    expect(result[0].vectorScore).toBe(0.8);
    expect(result[0].keywordScore).toBe(0.3);
    expect(result[0].graphScore).toBe(0.9);
    expect(result[0].graphConfidence).toBe(0.82);
    expect(result[0].rrfScore).toBeGreaterThan(0.2);
  });

  it("adds graph-only hits without vector or keyword scores", () => {
    const graphHits: GraphSearchHit[] = [
      {
        vectorId: "chunk-2",
        text: "knowledge graph traversal",
        metadata: { ...baseMeta, chunkIndex: 1 },
        vectorScore: 0,
        keywordScore: 0,
        rrfScore: 0,
        graphScore: 0.75,
        graphConfidence: 0.7,
        graphMatchedNodes: [],
      },
    ];

    const result = fuseGraphSearchResults([], graphHits, {
      rrfK: 60,
      graphWeight: 0.25,
    });

    expect(result).toHaveLength(1);
    expect(result[0].vectorScore).toBe(0);
    expect(result[0].keywordScore).toBe(0);
    expect(result[0].graphScore).toBe(0.75);
    expect(result[0].rrfScore).toBeGreaterThan(0);
  });
});
