import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RankedChunkHit } from "../../../types/search";
import type { DocumentMetaForRanking } from "../../rankingService";
import type { CrossEncoderProvider, RerankScore } from "../rerankerTypes";
import {
  computeFinalScore,
  getFinalScoreWeights,
  buildRerankDocumentText,
  rerankCandidates,
} from "../rerankerService";
import {
  batchRerank,
  isRetryableRerankError,
  normalizeCrossEncoderScores,
  rerankWithRetry,
  rerankWithTimeout,
} from "../crossEncoder";
import {
  createRerankProvider,
  resetRerankProviderCache,
} from "../rerankerFactory";

function makeChunk(
  id: string,
  finalScore: number,
  text: string,
  overrides: Partial<RankedChunkHit> = {}
): RankedChunkHit {
  return {
    vectorId: id,
    documentId: "doc1",
    chunkIndex: 0,
    text,
    contentPreview: text.slice(0, 200),
    metadata: { documentId: "doc1", chunkIndex: 0 },
    vectorScore: 0.5,
    keywordScore: 0.3,
    topicScore: 0.1,
    titleScore: 0.1,
    documentTitleScore: 0.1,
    metadataScore: 0.2,
    phraseScore: 0,
    rrfScore: 0.4,
    finalScore,
    confidenceScore: 0,
    matchedKeywords: ["react"],
    ...overrides,
  };
}

const docMeta = new Map<string, DocumentMetaForRanking>([
  ["doc1", { title: "React Guide", type: "pdf", createdAt: new Date("2026-06-01") }],
]);

describe("computeFinalScore", () => {
  it("applies configurable weights", () => {
    const score = computeFinalScore(
      {
        crossEncoderScore: 1,
        hybridScore: 0.5,
        keywordScore: 0.3,
        metadataScore: 0.2,
        recencyScore: 0.8,
      },
      { rerank: 0.7, hybrid: 0.15, keyword: 0.05, metadata: 0.05, recency: 0.05 }
    );

    expect(score).toBeCloseTo(0.7 + 0.075 + 0.015 + 0.01 + 0.04, 4);
  });

  it("uses env defaults via getFinalScoreWeights", () => {
    const weights = getFinalScoreWeights();
    const sum =
      weights.rerank +
      weights.hybrid +
      weights.keyword +
      weights.metadata +
      weights.recency;
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe("normalizeCrossEncoderScores", () => {
  it("normalizes scores to 0-1 range", () => {
    const normalized = normalizeCrossEncoderScores([
      { id: "a", score: 0.2 },
      { id: "b", score: 0.8 },
      { id: "c", score: 0.5 },
    ]);

    expect(normalized[0].score).toBe(0);
    expect(normalized[1].score).toBe(1);
    expect(normalized[2].score).toBe(0.5);
  });

  it("returns 1 for identical scores", () => {
    const normalized = normalizeCrossEncoderScores([
      { id: "a", score: 0.5 },
      { id: "b", score: 0.5 },
    ]);
    expect(normalized.every((s) => s.score === 1)).toBe(true);
  });
});

describe("buildRerankDocumentText", () => {
  it("includes rich metadata context", () => {
    const hit = makeChunk("v1", 0.5, "Chunk body text", {
      title: "Hooks",
      topic: "React",
      summary: "Intro to hooks",
      keywords: ["useState"],
      sectionPath: ["Chapter 1", "Hooks"],
    });

    const text = buildRerankDocumentText(hit, "React Guide");

    expect(text).toContain("Document: React Guide");
    expect(text).toContain("Section: Hooks");
    expect(text).toContain("Chapter: Chapter 1 > Hooks");
    expect(text).toContain("Topic: React");
    expect(text).toContain("Summary: Intro to hooks");
    expect(text).toContain("Keywords: useState");
    expect(text).toContain("Chunk body text");
  });
});

describe("provider abstraction", () => {
  beforeEach(() => resetRerankProviderCache());
  afterEach(() => resetRerankProviderCache());

  it("creates BGE provider by default", () => {
    const provider = createRerankProvider("bge");
    expect(provider.name).toBe("bge");
  });

  it("creates Jina provider", () => {
    const provider = createRerankProvider("jina");
    expect(provider.name).toBe("jina");
  });

  it("creates Cohere provider", () => {
    const provider = createRerankProvider("cohere");
    expect(provider.name).toBe("cohere");
  });
});

describe("rerankCandidates", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ENABLE_RERANKER = "true";
    process.env.HUGGINGFACE_API_KEY = "test-hf-key";
    process.env.RERANK_PROVIDER = "bge";
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("skips reranking when disabled", async () => {
    process.env.ENABLE_RERANKER = "false";
    vi.resetModules();

    const { rerankCandidates: rerank } = await import("../rerankerService");

    const candidates = [makeChunk("a", 0.9, "text a"), makeChunk("b", 0.5, "text b")];
    const result = await rerank({
      query: "react hooks",
      candidates,
      documentMeta: docMeta,
    });

    expect(result.debug.stage).toBe("skipped");
    expect(result.chunks).toEqual(candidates);
  });

  it("falls back when provider credentials are missing", async () => {
    process.env.HUGGINGFACE_API_KEY = "";
    vi.resetModules();

    const { rerankCandidates: rerank } = await import("../rerankerService");

    const candidates = [makeChunk("a", 0.9, "text a")];
    const result = await rerank({
      query: "react",
      candidates,
      documentMeta: docMeta,
    });

    expect(result.debug.stage).toBe("skipped");
    expect(result.chunks).toEqual(candidates);
  });
});

describe("isRetryableRerankError", () => {
  it("does not retry timeouts", () => {
    expect(isRetryableRerankError(new Error("Reranker timed out after 10000ms"))).toBe(
      false
    );
  });

  it("retries rate limits and gateway errors", () => {
    const err = Object.assign(new Error("rate limited"), {
      response: { status: 429 },
    });
    expect(isRetryableRerankError(err)).toBe(true);
  });
});

describe("batchRerank", () => {
  it("processes documents in batches", async () => {
    const calls: number[] = [];
    const provider: CrossEncoderProvider = {
      name: "batch-mock",
      rerank: async (_query, docs) => {
        calls.push(docs.length);
        return docs.map((d) => ({ id: d.id, score: 0.5 }));
      },
    };

    const docs = Array.from({ length: 5 }, (_, i) => ({
      id: `d${i}`,
      text: `text ${i}`,
    }));

    const scores = await batchRerank(provider, "query", docs, 2);

    expect(scores).toHaveLength(5);
    expect(calls).toEqual([2, 2, 1]);
  });
});

describe("rerankWithRetry", () => {
  it("retries transient failures then succeeds", async () => {
    let attempts = 0;
    const provider: CrossEncoderProvider = {
      name: "flaky",
      rerank: async () => {
        attempts += 1;
        if (attempts === 1) {
          const err = Object.assign(new Error("503"), { response: { status: 503 } });
          throw err;
        }
        return [{ id: "a", score: 0.9 }];
      },
    };

    const result = await rerankWithRetry(
      provider,
      "q",
      [{ id: "a", text: "t" }],
      32,
      5000,
      2
    );

    expect(result.scores).toHaveLength(1);
    expect(result.retryAttempts).toBe(1);
    expect(attempts).toBe(2);
  });

  it("does not retry timeouts", async () => {
    let attempts = 0;
    const provider: CrossEncoderProvider = {
      name: "slow",
      rerank: () => {
        attempts += 1;
        return new Promise((resolve) =>
          setTimeout(() => resolve([{ id: "a", score: 1 }]), 200)
        );
      },
    };

    await expect(
      rerankWithRetry(provider, "q", [{ id: "a", text: "t" }], 32, 50, 2)
    ).rejects.toThrow("timed out");

    expect(attempts).toBe(1);
  });
});

describe("rerankCandidates with mock provider", () => {
  it("reorders candidates by cross-encoder score", async () => {
    const mockProvider: CrossEncoderProvider = {
      name: "mock",
      rerank: async (_query, docs): Promise<RerankScore[]> =>
        docs.map((d) => ({
          id: d.id,
          score: d.id === "low-heuristic" ? 0.95 : 0.1,
        })),
    };

    vi.doMock("../rerankerFactory", () => ({
      createRerankProvider: () => mockProvider,
      resolveDefaultProviderId: () => "bge",
      resetRerankProviderCache: () => {},
    }));

    process.env.ENABLE_RERANKER = "true";
    process.env.HUGGINGFACE_API_KEY = "test";
    vi.resetModules();

    const { rerankCandidates: rerank } = await import("../rerankerService");

    const candidates = [
      makeChunk("high-heuristic", 0.95, "heuristic winner"),
      makeChunk("low-heuristic", 0.3, "cross encoder winner"),
    ];

    const result = await rerank({
      query: "react",
      candidates,
      documentMeta: docMeta,
    });

    expect(result.debug.stage).toBe("rerank");
    expect(result.chunks[0].vectorId).toBe("low-heuristic");
    expect(result.chunks[0].crossEncoderScore).toBeGreaterThan(
      result.chunks[1].crossEncoderScore ?? 0
    );
  });

  it("falls back on provider failure", async () => {
    const mockProvider: CrossEncoderProvider = {
      name: "mock",
      rerank: async () => {
        throw new Error("Provider unavailable");
      },
    };

    vi.doMock("../rerankerFactory", () => ({
      createRerankProvider: () => mockProvider,
      resolveDefaultProviderId: () => "bge",
      resetRerankProviderCache: () => {},
    }));

    process.env.ENABLE_RERANKER = "true";
    process.env.HUGGINGFACE_API_KEY = "test";
    vi.resetModules();

    const { rerankCandidates: rerank } = await import("../rerankerService");

    const candidates = [
      makeChunk("a", 0.9, "first"),
      makeChunk("b", 0.5, "second"),
    ];

    const result = await rerank({
      query: "react",
      candidates,
      documentMeta: docMeta,
    });

    expect(result.debug.stage).toBe("fallback");
    expect(result.debug.error).toContain("Provider unavailable");
    expect(result.chunks.map((c) => c.vectorId)).toEqual(["a", "b"]);
  });

  it("handles timeout via rerankWithTimeout", async () => {
    const { rerankWithTimeout } = await import("../crossEncoder");

    const slowProvider: CrossEncoderProvider = {
      name: "slow",
      rerank: () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve([{ id: "a", score: 1 }]),
            200
          )
        ),
    };

    await expect(
      rerankWithTimeout(slowProvider, "q", [{ id: "a", text: "t" }], 32, 50)
    ).rejects.toThrow("timed out");
  });
});

describe("ranking improvements", () => {
  it("promotes semantically relevant chunk over keyword match", () => {
    const weights = {
      rerank: 0.7,
      hybrid: 0.15,
      keyword: 0.05,
      metadata: 0.05,
      recency: 0.05,
    };

    const keywordMatch = computeFinalScore(
      {
        crossEncoderScore: 0.2,
        hybridScore: 0.9,
        keywordScore: 0.9,
        metadataScore: 0.1,
        recencyScore: 0.5,
      },
      weights
    );

    const semanticMatch = computeFinalScore(
      {
        crossEncoderScore: 0.95,
        hybridScore: 0.4,
        keywordScore: 0.2,
        metadataScore: 0.1,
        recencyScore: 0.5,
      },
      weights
    );

    expect(semanticMatch).toBeGreaterThan(keywordMatch);
  });
});

describe("regression", () => {
  it("preserves heuristic order when reranking is disabled", async () => {
    process.env.ENABLE_RERANKER = "false";
    vi.resetModules();

    const { rerankCandidates: rerank } = await import("../rerankerService");

    const candidates = [
      makeChunk("first", 0.95, "best heuristic"),
      makeChunk("second", 0.5, "weaker"),
    ];

    const result = await rerank({
      query: "react",
      candidates,
      documentMeta: docMeta,
    });

    expect(result.chunks.map((c) => c.vectorId)).toEqual(["first", "second"]);
    expect(result.debug.stage).toBe("skipped");
  });
});
