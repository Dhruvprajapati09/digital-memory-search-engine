import { describe, expect, it } from "vitest";
import {
  formatSourcePages,
  prepareSources,
} from "../chatSources";
import type { ChatSource } from "../../types/chat";

describe("formatSourcePages", () => {
  it("formats single and multiple pages", () => {
    expect(formatSourcePages([])).toBe("");
    expect(formatSourcePages([12])).toBe(" (p.12)");
    expect(formatSourcePages([12, 45])).toBe(" (p.12, p.45)");
  });
});

describe("prepareSources", () => {
  it("dedupes by documentId and merges pages sorted unique", () => {
    const sources: ChatSource[] = [
      {
        documentId: "doc-1",
        documentName: "NLP Chapter 5.pdf",
        preview: "first chunk",
        page: 45,
      },
      {
        documentId: "doc-1",
        documentName: "NLP Chapter 5.pdf",
        preview: "second chunk",
        page: 12,
      },
      {
        documentId: "doc-1",
        documentName: "NLP Chapter 5.pdf",
        preview: "third chunk",
        page: 45,
      },
      {
        documentId: "doc-2",
        documentName: "Other.pdf",
        preview: "other",
        page: 3,
      },
    ];

    const prepared = prepareSources(sources);

    expect(prepared).toHaveLength(2);
    expect(prepared[0]).toMatchObject({
      documentId: "doc-1",
      documentName: "NLP Chapter 5.pdf",
      preview: "first chunk",
      pages: [12, 45],
      page: 12,
    });
    expect(prepared[1]).toMatchObject({
      documentId: "doc-2",
      documentName: "Other.pdf",
      pages: [3],
      page: 3,
    });
  });

  it("keeps sources without pages", () => {
    const prepared = prepareSources([
      {
        documentId: "doc-1",
        documentName: "NoPages.pdf",
        preview: "text",
      },
    ]);

    expect(prepared[0].pages).toEqual([]);
    expect(prepared[0].page).toBeUndefined();
  });
});
