import { describe, expect, it } from "vitest";
import { markDuplicateChunks } from "../duplicateDetectionService";
import type { SearchV2RankedChunk } from "../../../types/searchV2";

function ranked(id: string, text: string): SearchV2RankedChunk {
  return {
    chunk: {
      vectorId: id,
      documentId: "doc-1",
      chunkIndex: 0,
      text,
      contentPreview: text,
      metadata: {
        documentId: "doc-1",
        userId: "user-1",
        chunkIndex: 0,
        type: "note",
      },
      vectorScore: 0,
      keywordScore: 0,
      topicScore: 0,
      titleScore: 0,
      documentTitleScore: 0,
      metadataScore: 0,
      phraseScore: 0,
      rrfScore: 0,
      finalScore: 0,
      confidenceScore: 0,
      matchedKeywords: [],
    },
    learningScore: 0.5,
    popularityScore: 0,
    freshnessScore: 0,
    citationScore: 0,
  };
}

describe("markDuplicateChunks", () => {
  it("marks exact duplicate chunks", () => {
    const result = markDuplicateChunks([
      ranked("a", "React hooks and authentication patterns"),
      ranked("b", "authentication patterns React hooks and"),
    ]);

    expect(result[1].duplicateOf).toBe("a");
  });
});
