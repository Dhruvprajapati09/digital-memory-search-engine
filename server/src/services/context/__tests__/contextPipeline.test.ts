import { describe, expect, it } from "vitest";
import {
  jaccardSimilarity,
  isNearDuplicate,
  deduplicateExact,
  removeDuplicateChunks,
} from "../duplicateDetectionService";
import { orderChunksLogically } from "../contextOrderingService";
import type { RetrievedChunk } from "../../../types/chat";

function makeChunk(
  docId: string,
  index: number,
  text: string,
  score = 0.9
): RetrievedChunk {
  return {
    vectorId: `${docId}-${index}`,
    score,
    text,
    metadata: {
      documentId: docId,
      userId: "user1",
      chunkIndex: index,
      type: "note",
      documentTitle: "Doc A",
      sectionPath: ["Chapter 1", "Section A"],
      chapter: "Chapter 1",
      section: "Section A",
    },
    topic: "Topic",
    title: "Section A",
    contentPreview: text.slice(0, 50),
  };
}

describe("duplicateDetectionService", () => {
  it("detects near duplicates via jaccard", () => {
    const a = new Set(["mongodb", "index", "database"]);
    const b = new Set(["mongodb", "index", "performance"]);
    expect(jaccardSimilarity(a, b)).toBeGreaterThan(0.4);
  });

  it("flags near duplicate text", () => {
    const a =
      "MongoDB indexing improves query performance using btree structures for collections";
    const b =
      "MongoDB indexing improves query performance using btree structures for documents";
    expect(isNearDuplicate(a, b)).toBe(true);
  });

  it("deduplicates exact chunk keys", () => {
    const chunks = [
      makeChunk("d1", 0, "text one", 0.5),
      makeChunk("d1", 0, "text one updated", 0.9),
    ];
    const result = deduplicateExact(chunks);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(0.9);
  });

  it("removeDuplicateChunks keeps highest score", () => {
    const chunks = [
      makeChunk("d1", 0, "react hooks state management guide", 0.95),
      makeChunk("d1", 1, "react hooks state management tutorial", 0.7),
    ];
    const result = removeDuplicateChunks(chunks);
    expect(result.length).toBeLessThanOrEqual(2);
    expect(result[0].score).toBeGreaterThanOrEqual(
      result[result.length - 1].score
    );
  });
});

describe("contextOrderingService", () => {
  it("orders chunks by document then chunk index", () => {
    const chunks = [
      makeChunk("d1", 2, "third"),
      makeChunk("d1", 0, "first"),
      makeChunk("d1", 1, "second"),
    ];
    const ordered = orderChunksLogically(chunks);
    expect(ordered.map((c) => c.metadata.chunkIndex)).toEqual([0, 1, 2]);
  });
});
