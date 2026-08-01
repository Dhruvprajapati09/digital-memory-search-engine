import { describe, expect, it } from "vitest";
import {
  formatChunkBlock,
  resolveDocumentDisplayName,
  buildSourcesFromChunks,
} from "../contextBuilder";
import type { RetrievedChunk } from "../../../types/chat";

function makeChunk(
  overrides: Partial<RetrievedChunk> & {
    metadata?: Partial<RetrievedChunk["metadata"]>;
  } = {}
): RetrievedChunk {
  const { metadata: metaOverrides, ...rest } = overrides;
  return {
    vectorId: "vec-1",
    score: 0.91,
    text: "Hidden Markov models are used for sequence labeling.",
    metadata: {
      documentId: "doc-1",
      userId: "user-1",
      chunkIndex: 0,
      type: "pdf",
      documentTitle: "Generic Title",
      documentName: "Generic Name",
      originalFileName: "Hidden Markov Model.pdf",
      pageNumber: 8,
      ...metaOverrides,
    },
    ...rest,
  };
}

describe("resolveDocumentDisplayName", () => {
  it("prefers originalFileName over documentName and documentTitle", () => {
    const chunk = makeChunk({
      metadata: {
        originalFileName: "NLP Chapter 5.pdf",
        documentName: "NLP Notes",
        documentTitle: "Chapter 5",
      },
    });
    expect(resolveDocumentDisplayName(chunk)).toBe("NLP Chapter 5.pdf");
  });

  it("falls back to documentName then documentTitle then Untitled", () => {
    expect(
      resolveDocumentDisplayName(
        makeChunk({
          metadata: {
            originalFileName: undefined,
            documentName: "Notes.pdf",
            documentTitle: "Title",
          },
        })
      )
    ).toBe("Notes.pdf");

    expect(
      resolveDocumentDisplayName(
        makeChunk({
          metadata: {
            originalFileName: undefined,
            documentName: undefined,
            documentTitle: "Only Title",
          },
        })
      )
    ).toBe("Only Title");

    expect(
      resolveDocumentDisplayName(
        makeChunk({
          metadata: {
            originalFileName: undefined,
            documentName: undefined,
            documentTitle: undefined,
          },
        })
      )
    ).toBe("Untitled");
  });
});

describe("formatChunkBlock", () => {
  it("labels with filename and page, not Source N", () => {
    const block = formatChunkBlock(makeChunk(), 0);

    expect(block).toContain("[Document: Hidden Markov Model.pdf | Page: 8]");
    expect(block).not.toMatch(/\[Source\s+\d+\]/);
    expect(block).toContain("Hidden Markov models are used for sequence labeling.");
  });

  it("omits page from bracket label when page is unknown", () => {
    const block = formatChunkBlock(
      makeChunk({
        metadata: { pageNumber: undefined, page: undefined },
      })
    );

    expect(block).toContain("[Document: Hidden Markov Model.pdf]");
    expect(block).not.toContain("| Page:");
  });

  it("labels video chunks with title and timestamp", () => {
    const block = formatChunkBlock(
      makeChunk({
        metadata: {
          type: "video",
          originalFileName: undefined,
          documentTitle: "Lecture 3",
          documentName: undefined,
          youtubeVideoId: "abc123",
          timestampFormatted: "12:34",
          pageNumber: undefined,
        },
      })
    );

    expect(block).toContain("[Video: Lecture 3 | Timestamp: 12:34]");
    expect(block).not.toMatch(/\[Source\s+\d+\]/);
  });
});

describe("buildSourcesFromChunks", () => {
  it("sets documentName via resolveDocumentDisplayName", () => {
    const sources = buildSourcesFromChunks([makeChunk()]);
    expect(sources[0].documentName).toBe("Hidden Markov Model.pdf");
    expect(sources[0].page).toBe(8);
  });
});
