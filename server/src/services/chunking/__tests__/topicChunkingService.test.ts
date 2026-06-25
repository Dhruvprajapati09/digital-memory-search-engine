import { describe, expect, it } from "vitest";
import { chunkTextByTopics } from "../topicChunkingService";
import { parseDocumentStructure } from "../structureParser";

const REACT_NOTES = `
# React Notes

## Hooks
Hooks let you use state in function components.

## Memoization
Memoization avoids unnecessary re-renders.

### useMemo
useMemo caches expensive computations between renders.

### useCallback
useCallback caches function references for child components.

## Context API
Context provides global state without prop drilling.
`.trim();

describe("topicChunkingService", () => {
  it("returns empty array for empty text", () => {
    expect(chunkTextByTopics("")).toEqual([]);
    expect(chunkTextByTopics("   ")).toEqual([]);
  });

  it("creates topic-aligned chunks from markdown headings", () => {
    const chunks = chunkTextByTopics(REACT_NOTES, {
      documentTitle: "React Notes",
    });

    expect(chunks.length).toBeGreaterThanOrEqual(4);

    const memoizationChunks = chunks.filter(
      (c) =>
        c.topic.toLowerCase().includes("memoization") ||
        c.sectionPath.some((p) => p.toLowerCase().includes("memoization"))
    );

    expect(memoizationChunks.length).toBeGreaterThanOrEqual(2);

    const useMemoChunk = chunks.find((c) =>
      c.title.toLowerCase().includes("usememo")
    );
    expect(useMemoChunk).toBeDefined();
    expect(useMemoChunk?.text.toLowerCase()).toContain("usememo");
  });

  it("preserves section path hierarchy", () => {
    const chunks = chunkTextByTopics(REACT_NOTES, {
      documentTitle: "React Notes",
    });

    const subtopic = chunks.find((c) => c.title === "useMemo");
    expect(subtopic?.sectionPath).toEqual(["Memoization", "useMemo"]);
    expect(subtopic?.topic).toBe("Memoization");
    expect(subtopic?.subtopic).toBe("useMemo");
  });

  it("does not split small topics across chunks", () => {
    const text = `# Topic A\n\nShort content about alpha.\n\n## Sub A1\n\nMore alpha details.`;
    const chunks = chunkTextByTopics(text, { documentTitle: "Doc" });

    expect(chunks.every((c) => c.text.includes("alpha") || c.text.includes("Sub"))).toBe(
      true
    );
  });
});

describe("structureParser", () => {
  it("detects markdown headings and builds a tree", () => {
    const root = parseDocumentStructure(REACT_NOTES, "React Notes");
    expect(root.children.length).toBeGreaterThan(0);

    const titles = root.children.map((c) => c.title);
    expect(titles).toContain("Hooks");
    expect(titles).toContain("Memoization");
  });
});
