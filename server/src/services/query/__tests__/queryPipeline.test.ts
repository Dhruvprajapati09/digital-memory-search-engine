import { describe, expect, it } from "vitest";
import { normalizeQueryText } from "../queryNormalizer";
import { detectIntent } from "../intentDetectionService";
import { extractKeywords } from "../keywordExtractionService";
import { extractEntities } from "../entityExtractionService";
import { expandQueryTerms } from "../queryExpansionService";
import { detectMetadataHints } from "../metadataHintService";
import { buildRetrievalQuery } from "../queryPipeline";
import type { QueryPipelineResult } from "../../../types/query";

function pipelineStub(
  partial: Partial<QueryPipelineResult> &
    Pick<QueryPipelineResult, "original" | "normalized" | "keywords">
): QueryPipelineResult {
  return {
    intent: "search",
    confidence: 1,
    entities: [],
    expandedTerms: [],
    metadataHints: {},
    ...partial,
  };
}

describe("queryNormalizer", () => {
  it("lowercases and collapses whitespace", () => {
    const result = normalizeQueryText("  MongoDB   Indexing  ");
    expect(result.original).toBe("  MongoDB   Indexing  ");
    expect(result.normalized).toBe("mongodb indexing");
  });

  it("normalizes smart quotes", () => {
    const result = normalizeQueryText('"react hooks"');
    expect(result.normalized).toContain("react hooks");
  });
});

describe("intentDetectionService", () => {
  it("detects definition intent", () => {
    const { intent } = detectIntent("what is mongodb indexing");
    expect(intent).toBe("definition");
  });

  it("detects comparison intent", () => {
    const { intent } = detectIntent("react vs vue");
    expect(intent).toBe("comparison");
  });

  it("detects question intent from trailing ?", () => {
    const { intent } = detectIntent("how does indexing work?");
    expect(intent).toBe("question");
  });

  it("defaults to search", () => {
    const { intent } = detectIntent("mongodb notes");
    expect(intent).toBe("search");
  });
});

describe("keywordExtractionService", () => {
  it("extracts keywords ignoring stop words", () => {
    const keywords = extractKeywords("how to use mongodb indexing");
    expect(keywords).toContain("mongodb");
    expect(keywords).toContain("index");
    expect(keywords).not.toContain("how");
  });
});

describe("buildRetrievalQuery", () => {
  it("maps NL questions to content keywords", () => {
    const normalized = "what is markov model?";
    const keywords = extractKeywords(normalized);
    const q = buildRetrievalQuery(
      pipelineStub({
        original: "What is Markov Model?",
        normalized,
        keywords,
      })
    );
    expect(q).toContain("markov");
    expect(q).toContain("model");
    expect(q).not.toContain("what");
    expect(q).not.toContain("?");
  });

  it("maps explain/tell me about phrasing to keywords", () => {
    const cases = [
      "Explain Binary Search Tree",
      "Tell me about React Hooks",
      "Define Markov Model",
    ];
    for (const original of cases) {
      const { normalized } = normalizeQueryText(original);
      const keywords = extractKeywords(normalized);
      const q = buildRetrievalQuery(
        pipelineStub({ original, normalized, keywords })
      );
      expect(q.length).toBeGreaterThan(0);
      expect(q).not.toMatch(/^(explain|tell|define|about|what|is)\b/);
    }
  });

  it("keeps bare keyword queries usable", () => {
    const { normalized } = normalizeQueryText("Markov Model");
    const keywords = extractKeywords(normalized);
    const q = buildRetrievalQuery(
      pipelineStub({
        original: "Markov Model",
        normalized,
        keywords,
      })
    );
    expect(q).toContain("markov");
    expect(q).toContain("model");
  });

  it("never returns empty — falls back to normalized/original", () => {
    const q = buildRetrievalQuery(
      pipelineStub({
        original: "???",
        normalized: "",
        keywords: [],
      })
    );
    expect(q.trim().length).toBeGreaterThan(0);
  });
});

describe("entityExtractionService", () => {
  it("extracts dictionary entities", () => {
    const entities = extractEntities({
      normalizedQuery: "mongodb indexing with express api",
    });
    expect(entities.some((e) => e.toLowerCase().includes("mongodb"))).toBe(true);
  });

  it("extracts CamelCase identifiers", () => {
    const entities = extractEntities({
      normalizedQuery: "usememo react hook",
    });
    expect(entities.some((e) => e.toLowerCase().includes("react"))).toBe(true);
  });
});

describe("queryExpansionService", () => {
  it("expands mongodb indexing terms", () => {
    const expanded = expandQueryTerms({
      keywords: ["mongodb", "indexing"],
      entities: ["MongoDB"],
      limit: 15,
    });
    expect(expanded.some((t) => t.includes("index"))).toBe(true);
    expect(expanded.some((t) => t.includes("database") || t.includes("mongo"))).toBe(
      true
    );
  });
});

describe("metadataHintService", () => {
  it("detects pdf document type hint", () => {
    const hints = detectMetadataHints("find my pdf about algorithms", [], [
      "algorithms",
    ]);
    expect(hints.documentType).toBe("pdf");
  });

  it("detects date hint for recently", () => {
    const hints = detectMetadataHints("notes uploaded recently", [], ["notes"]);
    expect(hints.date).toBe("7d");
  });
});
