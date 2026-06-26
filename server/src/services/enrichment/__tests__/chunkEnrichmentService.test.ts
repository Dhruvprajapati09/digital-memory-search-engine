import { describe, expect, it } from "vitest";
import {
  enrichChunkMetadata,
  buildEmbeddingText,
} from "../chunkEnrichmentService";
import type { TopicChunk } from "../../types/chunking";

describe("chunkEnrichmentService", () => {
  const chunk: TopicChunk = {
    chunkIndex: 2,
    text: "useMemo caches expensive computations between renders in React.",
    title: "useMemo",
    topic: "Memoization",
    subtopic: "useMemo",
    sectionPath: ["React Notes", "Memoization", "useMemo"],
    level: "subtopic",
    parentChunkIndex: 1,
    tokenCount: 12,
    contentPreview: "useMemo caches expensive...",
  };

  it("extracts topic-aligned keywords and tags", () => {
    const meta = enrichChunkMetadata(chunk);

    expect(meta.topic).toBe("Memoization");
    expect(meta.subtopic).toBe("useMemo");
    expect(meta.keywords.length).toBeGreaterThan(0);
    expect(meta.tags).toContain("memoization");
    expect(meta.summary).toContain("useMemo");
  });

  it("builds embedding text with topic context prefix", () => {
    const meta = enrichChunkMetadata(chunk);
    const embedText = buildEmbeddingText(chunk, meta);

    expect(embedText).toContain("Topic: Memoization");
    expect(embedText).toContain("Subtopic: useMemo");
    expect(embedText).toContain("useMemo caches");
  });
});
