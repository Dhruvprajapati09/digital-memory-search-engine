import { describe, expect, it } from "vitest";
import { applyLearningToRank } from "../learningRankingService";
import type { RankedChunkHit } from "../../../types/search";
import type {
  SearchV2StrategyPlan,
} from "../../../types/searchV2";
import type { PersonalizationSignals } from "../personalizationService";

function chunk(
  id: string,
  overrides: Partial<RankedChunkHit>
): RankedChunkHit {
  return {
    vectorId: id,
    documentId: `doc-${id}`,
    chunkIndex: 0,
    text: "React API authentication",
    topic: "React",
    title: "React APIs",
    sectionPath: [],
    contentPreview: "React API authentication",
    metadata: {
      documentId: `doc-${id}`,
      userId: "user-1",
      chunkIndex: 0,
      type: "note",
      heading: "React APIs",
    },
    vectorScore: 0.2,
    keywordScore: 0.2,
    topicScore: 0,
    titleScore: 0,
    documentTitleScore: 0,
    metadataScore: 0.1,
    phraseScore: 0,
    rrfScore: 0,
    finalScore: 0.2,
    confidenceScore: 0.2,
    matchedKeywords: [],
    ...overrides,
  };
}

const strategy: SearchV2StrategyPlan = {
  strategy: "relationship_search",
  confidence: 0.8,
  weights: {
    vector: 0.1,
    keyword: 0.1,
    metadata: 0.1,
    graph: 0.45,
    recency: 0,
    crossEncoder: 0.1,
    popularity: 0.1,
    freshness: 0.05,
  },
  candidateMultiplier: 8,
  contextWindow: 10,
  reasons: [],
};

const personalization: PersonalizationSignals = {
  recentQueries: ["react api"],
  queryAffinityTerms: ["react", "api"],
  documentBoosts: new Map(),
};

describe("applyLearningToRank", () => {
  it("promotes chunks with graph and citation evidence", () => {
    const lowGraph = chunk("a", { vectorScore: 0.8, graphScore: 0.05 });
    const highGraph = chunk("b", {
      vectorScore: 0.35,
      graphScore: 0.9,
      metadata: {
        documentId: "doc-b",
        userId: "user-1",
        chunkIndex: 0,
        type: "note",
        heading: "React APIs",
        pageNumber: 3,
      },
    });

    const ranked = applyLearningToRank(
      [lowGraph, highGraph],
      strategy,
      new Map([
        ["doc-a", { title: "A", type: "note", createdAt: new Date() }],
        ["doc-b", { title: "B", type: "note", createdAt: new Date() }],
      ]),
      personalization,
      ["react", "api"]
    );

    expect(ranked[0].chunk.vectorId).toBe("b");
    expect(ranked[0].citationScore).toBeGreaterThan(0);
  });
});
