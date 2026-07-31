import { describe, it, expect } from "vitest";
import {
  tokenizeQuery,
  computeKeywordScore,
  computeRecencyScore,
  rankDocumentGroups,
  generatePreviewSnippet,
  passesPrecisionGate,
  applyPrecisionFilters,
  groupRankedChunksIntoDocuments,
  dedupeRankedChunksById,
  collectMatchingPages,
} from "../rankingService";
import type { VectorSearchResult } from "../../types/embedding";
import type { RankedChunkHit } from "../../types/search";

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

describe("document grouping helpers", () => {
  function makeChunk(overrides: Partial<RankedChunkHit>): RankedChunkHit {
    return {
      vectorId: overrides.vectorId ?? "chunk-1",
      documentId: overrides.documentId ?? "digital-memory",
      chunkIndex: overrides.chunkIndex ?? 0,
      text:
        overrides.text ??
        "Digital Memory Search Engine stores searchable memory.",
      contentPreview:
        overrides.contentPreview ??
        overrides.text ??
        "Digital Memory Search Engine stores searchable memory.",
      metadata: {
        documentId: overrides.documentId ?? "digital-memory",
        userId: "user1",
        chunkIndex: overrides.chunkIndex ?? 0,
        type: "pdf",
        documentTitle: "Digital Memory Search Engine.pdf",
        pageNumber: overrides.pageNumber,
        ...overrides.metadata,
      },
      vectorScore: overrides.vectorScore ?? 0.98,
      keywordScore: overrides.keywordScore ?? 0,
      topicScore: overrides.topicScore ?? 0,
      titleScore: overrides.titleScore ?? 0,
      documentTitleScore: overrides.documentTitleScore ?? 0,
      metadataScore: overrides.metadataScore ?? 0,
      phraseScore: overrides.phraseScore ?? 0,
      rrfScore: overrides.rrfScore ?? 0.1,
      finalScore: overrides.finalScore ?? 0.98,
      confidenceScore: overrides.confidenceScore ?? 1,
      matchedKeywords: overrides.matchedKeywords ?? [],
      pageNumber: overrides.pageNumber,
    };
  }

  it("dedupes ranked chunks by vectorId", () => {
    const chunks = [
      makeChunk({ vectorId: "a", chunkIndex: 0, pageNumber: 12 }),
      makeChunk({ vectorId: "a", chunkIndex: 0, pageNumber: 12 }),
      makeChunk({ vectorId: "b", chunkIndex: 1, pageNumber: 18 }),
    ];

    const unique = dedupeRankedChunksById(chunks);
    expect(unique).toHaveLength(2);
    expect(unique.map((c) => c.vectorId)).toEqual(["a", "b"]);
  });

  it("collects unique sorted matching pages", () => {
    expect(
      collectMatchingPages([
        { pageNumber: 27 },
        { pageNumber: 12 },
        { pageNumber: 12 },
        { pageNumber: undefined },
        { pageNumber: 18 },
      ])
    ).toEqual([12, 18, 27]);
  });

  it("groups duplicate chunk ids into one document group", () => {
    const docMeta = new Map([
      [
        "digital-memory",
        {
          title: "Digital Memory Search Engine",
          type: "pdf",
          createdAt: new Date("2026-06-01"),
          originalFileName: "Digital_Memory_Search_Engine.pdf",
          storedFileName: "abc.pdf",
        },
      ],
    ]);

    const ranked = groupRankedChunksIntoDocuments(
      [
        makeChunk({
          vectorId: "a",
          chunkIndex: 0,
          pageNumber: 12,
          vectorScore: 0.98,
          finalScore: 0.98,
        }),
        makeChunk({
          vectorId: "a",
          chunkIndex: 0,
          pageNumber: 12,
          vectorScore: 0.98,
          finalScore: 0.98,
        }),
        makeChunk({
          vectorId: "b",
          chunkIndex: 1,
          pageNumber: 18,
          vectorScore: 0.9,
          finalScore: 0.9,
        }),
      ],
      docMeta
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].matchedChunks).toHaveLength(2);
    expect(ranked[0].pageNumber).toBe(12);
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

describe("precision filtering", () => {
  const docMeta = new Map([
    [
      "digital-memory",
      {
        title: "Digital Memory Search Engine.pdf",
        type: "pdf",
        createdAt: new Date("2026-06-01"),
        originalFileName: "Digital Memory Search Engine.pdf",
      },
    ],
    [
      "operating-system",
      {
        title: "Operating System.pdf",
        type: "pdf",
        createdAt: new Date("2026-06-01"),
      },
    ],
  ]);

  function makeChunk(overrides: Partial<RankedChunkHit>): RankedChunkHit {
    return {
      vectorId: overrides.vectorId ?? "chunk-1",
      documentId: overrides.documentId ?? "digital-memory",
      chunkIndex: overrides.chunkIndex ?? 0,
      text:
        overrides.text ??
        "Digital Memory Search Engine stores searchable memory.",
      topic: overrides.topic,
      subtopic: overrides.subtopic,
      title: overrides.title,
      summary: overrides.summary,
      keywords: overrides.keywords,
      tags: overrides.tags,
      sectionPath: overrides.sectionPath,
      contentPreview:
        overrides.contentPreview ??
        overrides.text ??
        "Digital Memory Search Engine stores searchable memory.",
      metadata: {
        documentId: overrides.documentId ?? "digital-memory",
        userId: "user1",
        chunkIndex: overrides.chunkIndex ?? 0,
        type: "pdf",
        documentTitle: "Digital Memory Search Engine.pdf",
        pageNumber: overrides.pageNumber,
        ...overrides.metadata,
      },
      vectorScore: overrides.vectorScore ?? 0.8,
      keywordScore: overrides.keywordScore ?? 0,
      topicScore: overrides.topicScore ?? 0,
      titleScore: overrides.titleScore ?? 0,
      documentTitleScore: overrides.documentTitleScore ?? 0,
      metadataScore: overrides.metadataScore ?? 0,
      phraseScore: overrides.phraseScore ?? 0,
      rrfScore: overrides.rrfScore ?? 0.1,
      finalScore: overrides.finalScore ?? 0.8,
      confidenceScore: overrides.confidenceScore ?? 1,
      matchedKeywords: overrides.matchedKeywords ?? [],
      pageNumber: overrides.pageNumber,
    };
  }

  const precisionOptions = {
    normalizedQuery: "what is digital memory search engine",
    keywords: ["digital", "memory", "search", "engine"],
    entities: [],
    documentMeta: docMeta,
    minVectorScore: 0.72,
    strongVectorScore: 0.86,
    minKeywordOverlap: 0.5,
    minMetadataOverlap: 0.34,
    minTitleOverlap: 0.5,
    dedupeSimilarity: 0.82,
  };

  it("keeps title and content relevant chunks", () => {
    const chunk = makeChunk({
      documentId: "digital-memory",
      text: "Digital Memory Search Engine is an AI-powered search platform.",
      pageNumber: 2,
    });

    expect(passesPrecisionGate(chunk, precisionOptions)).toBe(true);
  });

  it("rejects unrelated chunks with only weak vector similarity", () => {
    const chunk = makeChunk({
      documentId: "operating-system",
      vectorId: "os-1",
      vectorScore: 0.74,
      text: "Deadlock occurs when processes wait for resources.",
      topic: "Deadlock",
      title: "Deadlock",
      metadata: {
        documentTitle: "Operating System.pdf",
      },
    });

    expect(passesPrecisionGate(chunk, precisionOptions)).toBe(false);
  });

  it("removes duplicate chunks from the same document page", () => {
    const chunks = [
      makeChunk({
        vectorId: "a",
        pageNumber: 2,
        text: "Digital Memory Search Engine is an AI-powered platform for searching memory.",
        finalScore: 0.9,
      }),
      makeChunk({
        vectorId: "b",
        pageNumber: 2,
        text: "Digital Memory Search Engine is an AI powered platform for searching memory.",
        finalScore: 0.85,
      }),
    ];

    const filtered = applyPrecisionFilters(chunks, precisionOptions);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].vectorId).toBe("a");
  });
});
