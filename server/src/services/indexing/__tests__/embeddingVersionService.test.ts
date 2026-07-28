import { describe, expect, it } from "vitest";
import { needsReEmbedding, buildEmbeddingVersionMetadata } from "../embeddingVersionService";

describe("embeddingVersionService", () => {
  it("detects when re-embedding is needed", () => {
    expect(
      needsReEmbedding(
        { chunkHash: "abc", embeddingVersion: "1.0.0", embeddingModel: "mistral-embed" },
        { chunkHash: "abc", embeddingVersion: "1.0.0", embeddingModel: "mistral-embed" }
      )
    ).toBe(false);

    expect(
      needsReEmbedding(
        { chunkHash: "abc", embeddingVersion: "1.0.0", embeddingModel: "mistral-embed" },
        { chunkHash: "xyz", embeddingVersion: "1.0.0", embeddingModel: "mistral-embed" }
      )
    ).toBe(true);

    expect(
      needsReEmbedding(
        { chunkHash: "abc", embeddingVersion: "1.0.0", embeddingModel: "mistral-embed" },
        { chunkHash: "abc", embeddingVersion: "2.0.0", embeddingModel: "mistral-embed" }
      )
    ).toBe(true);
  });

  it("builds version metadata", () => {
    const meta = buildEmbeddingVersionMetadata("hash123", "mistral-embed");
    expect(meta.chunkHash).toBe("hash123");
    expect(meta.embeddingModel).toBe("mistral-embed");
    expect(meta.embeddingDate).toBeInstanceOf(Date);
  });
});
