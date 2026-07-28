import { describe, expect, it } from "vitest";
import {
  splitTextIntoEstimatedPages,
  resolvePageForLine,
  resolvePageRange,
  mapExtractionPagesToContent,
} from "../pageExtractionService";

describe("pageExtractionService", () => {
  it("splits text on form-feed page markers", () => {
    const text = "Page one content\fPage two content\fPage three";
    const pages = splitTextIntoEstimatedPages(text);

    expect(pages).toHaveLength(3);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[1].pageNumber).toBe(2);
    expect(pages[2].text).toContain("Page three");
  });

  it("estimates pages from line count when no form feeds", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
    const pages = splitTextIntoEstimatedPages(lines.join("\n"));

    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].pageNumber).toBe(1);
  });

  it("resolves page for line index", () => {
    const pages = [
      { pageNumber: 1, text: "a\nb\nc", lineStart: 0, lineEnd: 2 },
      { pageNumber: 2, text: "d\ne", lineStart: 3, lineEnd: 4 },
    ];

    expect(resolvePageForLine(pages, 1)?.pageNumber).toBe(1);
    expect(resolvePageForLine(pages, 4)?.pageNumber).toBe(2);
  });

  it("resolves page range spanning multiple pages", () => {
    const pages = [
      { pageNumber: 1, text: "a\nb", lineStart: 0, lineEnd: 1 },
      { pageNumber: 2, text: "c\nd", lineStart: 2, lineEnd: 3 },
    ];

    expect(resolvePageRange(pages, 0, 3)).toEqual({ start: 1, end: 2 });
  });

  it("maps extraction API pages to content with line offsets", () => {
    const pages = mapExtractionPagesToContent([
      { pageNumber: 1, text: "Hello\nWorld" },
      { pageNumber: 2, text: "Foo" },
    ]);

    expect(pages[0].lineStart).toBe(0);
    expect(pages[1].lineStart).toBeGreaterThan(pages[0].lineEnd);
  });
});
