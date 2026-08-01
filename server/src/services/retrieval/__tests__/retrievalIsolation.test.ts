import { beforeEach, describe, expect, it, vi } from "vitest";

const runQueryPipeline = vi.fn();
const retrieve = vi.fn();
const loadUserVocabulary = vi.fn();
const buildSpellingDictionaries = vi.fn();
const correctQuerySpelling = vi.fn();
const normalizeQueryText = vi.fn();

vi.mock("../../query/queryPipeline", () => ({
  runQueryPipeline: (...args: unknown[]) => runQueryPipeline(...args),
}));

vi.mock("../retrievalCore", () => ({
  retrieve: (...args: unknown[]) => retrieve(...args),
}));

vi.mock("../../query/vocabularyLoader", () => ({
  loadUserVocabulary: (...args: unknown[]) => loadUserVocabulary(...args),
}));

vi.mock("../../query/spellCorrectionService", () => ({
  buildSpellingDictionaries: (...args: unknown[]) =>
    buildSpellingDictionaries(...args),
  correctQuerySpelling: (...args: unknown[]) => correctQuerySpelling(...args),
}));

vi.mock("../../query/queryNormalizer", () => ({
  normalizeQueryText: (...args: unknown[]) => normalizeQueryText(...args),
}));

import { retrieveRelevantChunks } from "../retrievalService";

describe("retrieveRelevantChunks request isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadUserVocabulary.mockResolvedValue({
      keywords: new Set(),
      concepts: new Set(),
      tags: new Set(),
      documentTitles: new Set(),
    });
    buildSpellingDictionaries.mockReturnValue({
      primaryDictionary: [],
      fallbackDictionary: [],
      phraseCorrections: {},
    });
    normalizeQueryText.mockImplementation((q: string) => ({
      original: q,
      normalized: q.toLowerCase(),
    }));
    correctQuerySpelling.mockImplementation((q: string) => ({
      correctedQuery: q,
      corrections: [],
    }));
    runQueryPipeline.mockImplementation(async (q: string) => ({
      original: q,
      normalized: q,
      intent: "search",
      confidence: 1,
      entities: [],
      keywords: q.split(/\s+/),
      expandedTerms: [],
      metadataHints: {},
    }));
    retrieve.mockResolvedValue({
      normalizedQuery: "x",
      retrievalQuery: "x",
      filteredKeywords: ["x"],
      queryAnalysis: {},
      chunks: [],
      queryEmbeddingModel: "test",
      noDocumentsInScope: false,
      graphDebug: { cacheHit: false },
    });
  });

  it("rebuilds queryAnalysis per call and never reuses the previous request", async () => {
    await retrieveRelevantChunks({
      userId: "u1",
      query: "Hidden Markov Modl",
      conversationId: "c1",
    });
    await retrieveRelevantChunks({
      userId: "u1",
      query: "Hidden Markov Model",
      conversationId: "c1",
    });

    expect(runQueryPipeline).toHaveBeenCalledTimes(2);
    expect(runQueryPipeline.mock.calls[0][0]).toBe("hidden markov modl");
    expect(runQueryPipeline.mock.calls[1][0]).toBe("hidden markov model");

    expect(retrieve).toHaveBeenCalledTimes(2);
    const firstAnalysis = retrieve.mock.calls[0][0].queryAnalysis;
    const secondAnalysis = retrieve.mock.calls[1][0].queryAnalysis;
    expect(firstAnalysis).not.toBe(secondAnalysis);
    expect(firstAnalysis.normalized).toBe("hidden markov modl");
    expect(secondAnalysis.normalized).toBe("hidden markov model");
  });
});
