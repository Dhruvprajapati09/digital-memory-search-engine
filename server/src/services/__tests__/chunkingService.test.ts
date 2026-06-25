import { describe, expect, it } from "vitest";
import { chunkText } from "../chunkingService";
import { chunkTextByTopics } from "../chunking/topicChunkingService";

describe("chunkingService (legacy re-export)", () => {
  it("returns empty array for empty text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("creates a single chunk for short unstructured text", () => {
    const chunks = chunkText("Hello world this is a test");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].text).toContain("Hello world");
  });

  it("creates separate chunks per markdown section", () => {
    const text = `
# Notes

## Section A
Content for section A with enough words to form a valid chunk here.

## Section B
Content for section B with different topic material entirely.
`.trim();

    const chunks = chunkTextByTopics(text, { documentTitle: "Notes" });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });
});
