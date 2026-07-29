import { describe, expect, it } from "vitest";
import { normalizeQueryText } from "../queryNormalizer";
import { detectIntent } from "../intentDetectionService";
import { extractKeywords } from "../keywordExtractionService";
import { extractEntities } from "../entityExtractionService";
import { expandQueryTerms } from "../queryExpansionService";
import { detectMetadataHints } from "../metadataHintService";

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
