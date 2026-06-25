import { describe, expect, it } from "vitest";
import { fuseSearchResults } from "../hybridSearchService";
import type { VectorSearchResult, KeywordSearchResult } from "../../../types/embedding";

describe("hybridSearchService", () => {
  const baseMeta = {
    documentId: "doc1",
    userId: "user1",
    chunkIndex: 0,
    type: "note",
  };

  it("merges vector and keyword results via RRF", () => {
    const vectorHits: VectorSearchResult[] = [
      {
        vectorId: "a",
        score: 0.9,
        text: "memoization with useMemo",
        metadata: { ...baseMeta, chunkIndex: 0 },
        topic: "Memoization",
      },
      {
        vectorId: "b",
        score: 0.7,
        text: "context api provider",
        metadata: { ...baseMeta, chunkIndex: 1 },
        topic: "Context API",
      },
    ];

    const keywordHits: KeywordSearchResult[] = [
      {
        vectorId: "b",
        score: 2.5,
        text: "context api provider",
        metadata: { ...baseMeta, chunkIndex: 1 },
        topic: "Context API",
      },
      {
        vectorId: "c",
        score: 3.0,
        text: "memoization useCallback",
        metadata: { ...baseMeta, chunkIndex: 2 },
        topic: "Memoization",
      },
    ];

    const fused = fuseSearchResults(vectorHits, keywordHits);

    expect(fused.length).toBe(3);
    expect(fused.find((f) => f.vectorId === "a")?.vectorScore).toBe(0.9);
    expect(fused.find((f) => f.vectorId === "b")?.keywordScore).toBe(2.5);
    expect(fused.find((f) => f.vectorId === "c")?.vectorScore).toBe(0);
  });
});
