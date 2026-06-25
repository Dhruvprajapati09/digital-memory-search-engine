import { describe, it, expect } from "vitest";
import {
  tokenizeQuery,
  computeKeywordScore,
  computeRecencyScore,
  rankDocumentGroups,
  generatePreviewSnippet,
} from "../rankingService";
import type { VectorSearchResult } from "../../types/embedding";

describe("tokenizeQuery", () => {
  it("splits and normalizes query terms", () => {
    expect(tokenizeQuery("React Hooks!")).toEqual(["react", "hooks"]);
  });

  it("filters short terms", () => {
    expect(tokenizeQuery("a be cat")).toEqual(["be", "cat"]);
  });
});

describe("computeKeywordScore", () => {
  it("returns 1 when all terms match", () => {
    const score = computeKeywordScore(
      "react hooks allow state in components",
      ["react", "hooks"]
    );
    expect(score).toBe(1);
  });

  it("returns partial score for some matches", () => {
    const score = computeKeywordScore("react components only", [
      "react",
      "hooks",
    ]);
    expect(score).toBe(0.5);
  });
});

describe("computeRecencyScore", () => {
  it("returns higher score for newer documents", () => {
    const now = new Date("2026-06-23");
    const recent = new Date("2026-06-20");
    const old = new Date("2026-01-01");

    expect(computeRecencyScore(recent, now)).toBeGreaterThan(
      computeRecencyScore(old, now)
    );
  });
});

describe("rankDocumentGroups", () => {
  const docMeta = new Map([
    [
      "doc1",
      {
        title: "React Notes",
        type: "pdf",
        createdAt: new Date("2026-06-01"),
      },
    ],
    [
      "doc2",
      {
        title: "Node Guide",
        type: "note",
        createdAt: new Date("2026-05-01"),
      },
    ],
  ]);

  function makeHit(
    documentId: string,
    chunkIndex: number,
    score: number,
    text: string
  ): VectorSearchResult {
    return {
      vectorId: `v-${documentId}-${chunkIndex}`,
      score,
      text,
      metadata: {
        documentId,
        userId: "user1",
        chunkIndex,
        type: "pdf",
      },
    };
  }

  it("groups chunks by document and ranks by composite score", () => {
    const hits = [
      makeHit("doc1", 0, 0.9, "react hooks state"),
      makeHit("doc1", 1, 0.85, "react hooks lifecycle"),
      makeHit("doc2", 0, 0.7, "node express server"),
    ].map((h) => ({
      vectorId: h.vectorId,
      text: h.text,
      metadata: h.metadata,
      vectorScore: h.score,
      keywordScore: 0,
      rrfScore: h.score,
      topic: h.metadata.topic as string | undefined,
    }));

    const ranked = rankDocumentGroups(hits, docMeta, "react hooks");

    expect(ranked).toHaveLength(2);
    expect(ranked[0].documentId).toBe("doc1");
    expect(ranked[0].matchedChunks).toHaveLength(2);
    expect(ranked[0].finalScore).toBeGreaterThan(ranked[1].finalScore);
  });
});

describe("generatePreviewSnippet", () => {
  it("centers snippet around query term", () => {
    const text =
      "Introduction to programming. React Hooks allow developers to use state inside functional components without classes. Hooks are powerful.";

    const preview = generatePreviewSnippet(text, "react hooks", 40, 80);

    expect(preview.toLowerCase()).toContain("react hooks");
    expect(preview.length).toBeLessThanOrEqual(85);
  });

  it("returns short text unchanged", () => {
    expect(generatePreviewSnippet("short text", "short")).toBe("short text");
  });
});
