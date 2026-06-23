import { describe, expect, it } from "vitest";
import { chunkText } from "../chunkingService";

describe("chunkingService", () => {
  it("returns empty array for empty text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("creates a single chunk for short text", () => {
    const chunks = chunkText("Hello world this is a test");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].text).toContain("Hello world");
  });

  it("creates overlapping chunks for long text", () => {
    const words = Array.from({ length: 1500 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);

    // Overlap: chunk 2 should start around word 600
    expect(chunks[1].text).toContain("word600");
  });

  it("preserves word order across chunks", () => {
    const words = Array.from({ length: 900 }, (_, i) => `token${i}`);
    const chunks = chunkText(words.join(" "));

    expect(chunks[0].text.startsWith("token0")).toBe(true);
    expect(chunks[chunks.length - 1].text).toContain("token899");
  });
});
