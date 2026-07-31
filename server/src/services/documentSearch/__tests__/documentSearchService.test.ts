import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  buildMatchSnippet,
  findMatchesInText,
} from "../matchEngine";

/**
 * Lightweight verification that Module 1 search orchestration
 * does not import embedding / retrieve / pinecone paths.
 */
describe("documentSearchService module boundaries", () => {
  it("does not import AI retrieval or embedding modules", () => {
    const filePath = resolve(__dirname, "../documentSearchService.ts");
    const source = readFileSync(filePath, "utf8");

    expect(source).not.toMatch(/retrieve\s*\(/);
    expect(source).not.toMatch(/from\s+["'].*retrievalCore["']/);
    expect(source).not.toMatch(/generateQueryEmbedding/);
    expect(source).not.toMatch(/pinecone/i);
    expect(source).not.toMatch(/rerank/i);
  });

  it("searchService entrypoint delegates only to pure search", () => {
    const filePath = resolve(__dirname, "../../searchService.ts");
    const source = readFileSync(filePath, "utf8");

    expect(source).toContain("searchDocumentsPure");
    expect(source).not.toMatch(/from\s+["'].*retrievalCore["']/);
    expect(source).not.toMatch(/generateQueryEmbedding/);
  });
});

describe("multi-page occurrence grouping logic", () => {
  it("picks densest page and counts all occurrences", () => {
    const pages = [
      {
        pageNumber: 10,
        text: "Intro only.",
      },
      {
        pageNumber: 25,
        text: "Machine Learning is great. More Machine Learning examples.",
      },
      {
        pageNumber: 40,
        text: "One Machine Learning mention.",
      },
    ];

    const pageHits = pages
      .map((page) => {
        const match = findMatchesInText(page.text, "machine learning", {
          matchMode: "phrase",
        });
        return {
          pageNumber: page.pageNumber,
          occurrenceCount: match.occurrenceCount,
          preview: buildMatchSnippet(page.text, match.occurrences[0]),
          matchQuote: match.matchQuote,
        };
      })
      .filter((hit) => hit.occurrenceCount > 0);

    const occurrenceCount = pageHits.reduce(
      (sum, hit) => sum + hit.occurrenceCount,
      0
    );
    const best = [...pageHits].sort(
      (a, b) =>
        b.occurrenceCount - a.occurrenceCount || a.pageNumber - b.pageNumber
    )[0];

    expect(occurrenceCount).toBe(3);
    expect(best.pageNumber).toBe(25);
    expect(best.preview.toLowerCase()).toContain("machine learning");
    expect(pageHits.map((h) => h.pageNumber).sort((a, b) => a - b)).toEqual([
      25, 40,
    ]);
  });
});
