import { describe, expect, it } from "vitest";
import { createSemanticChunks } from "../semanticChunkingService";
import type { DocumentStructureElement } from "../../../types/documentIntelligence";

const REACT_STRUCTURE: DocumentStructureElement = {
  type: "title",
  title: "React Notes",
  content: "",
  level: 0,
  lineStart: 0,
  lineEnd: 20,
  chapter: "React Notes",
  children: [
    {
      type: "heading",
      title: "Hooks",
      content: "Hooks let you use state in function components.",
      level: 2,
      chapter: "React Notes",
      section: "Hooks",
      heading: "Hooks",
      lineStart: 2,
      lineEnd: 4,
      children: [],
    },
    {
      type: "section",
      title: "useMemo",
      content: "useMemo caches expensive computations between renders.",
      level: 3,
      chapter: "React Notes",
      section: "Memoization",
      heading: "useMemo",
      parentHeading: "Memoization",
      lineStart: 8,
      lineEnd: 10,
      children: [],
    },
  ],
};

describe("semanticChunkingService", () => {
  it("creates chunks at section boundaries", () => {
    const chunks = createSemanticChunks(REACT_STRUCTURE, [], {
      documentTitle: "React Notes",
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.heading === "Hooks")).toBe(true);
    expect(chunks.some((c) => c.heading === "useMemo")).toBe(true);
  });

  it("preserves chapter and section metadata", () => {
    const chunks = createSemanticChunks(REACT_STRUCTURE, [], {
      documentTitle: "React Notes",
    });

    const useMemo = chunks.find((c) => c.heading === "useMemo");
    expect(useMemo?.chapter).toBe("React Notes");
    expect(useMemo?.section).toBe("Memoization");
    expect(useMemo?.parentHeading).toBe("Memoization");
  });

  it("assigns page numbers when pages are provided", () => {
    const pages = [
      { pageNumber: 1, text: "Hooks content", lineStart: 0, lineEnd: 5 },
      { pageNumber: 2, text: "useMemo content", lineStart: 6, lineEnd: 12 },
    ];

    const chunks = createSemanticChunks(REACT_STRUCTURE, pages, {
      documentTitle: "React Notes",
    });

    expect(chunks.some((c) => c.pageNumber !== undefined)).toBe(true);
  });
});
