import { describe, expect, it } from "vitest";
import {
  computeChunkHash,
  enrichSemanticChunkMetadata,
  detectLanguage,
} from "../metadataEnrichmentService";
import type { SemanticChunk } from "../../../types/documentIntelligence";

describe("metadataEnrichmentService", () => {
  const baseChunk: SemanticChunk = {
    chunkIndex: 0,
    text: "MongoDB indexing improves query performance.",
    title: "Indexing",
    topic: "Database",
    section: "Indexing",
    chapter: "MongoDB Guide",
    heading: "Indexing",
    sectionPath: ["Database", "Indexing"],
    level: "subtopic",
    tokenCount: 8,
    contentPreview: "MongoDB indexing",
    entities: [{ name: "MongoDB", type: "database" }],
    relationships: [],
  };

  it("computes stable chunk hashes", () => {
    const hash1 = computeChunkHash("hello", "meta");
    const hash2 = computeChunkHash("hello", "meta");
    const hash3 = computeChunkHash("hello", "different");

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it("detects English language", () => {
    expect(detectLanguage("The quick brown fox jumps over the lazy dog.")).toBe("en");
  });

  it("enriches chunks with Phase 5 metadata fields", () => {
    const result = enrichSemanticChunkMetadata(baseChunk, "mistral-embed");

    expect(result.fields.chunkHash).toBeTruthy();
    expect(result.fields.embeddingVersion).toBeTruthy();
    expect(result.fields.language).toBe("en");
    expect(result.fields.entities).toHaveLength(1);
    expect(result.searchableText).toContain("MongoDB");
    expect(result.searchableText).toContain("Indexing");
  });
});
