import fs from "fs/promises";
import { PDFParse } from "pdf-parse";
import type { PageContent } from "../../types/documentIntelligence";
import type { PageExtractionData } from "../../types/extraction.types";

export interface PageExtractionResult {
  pages: PageContent[];
  fullText: string;
  totalPages: number;
}

/**
 * Extract page-level text from a PDF file.
 * Uses pdf-parse v2 per-page API when available.
 */
export async function extractPdfPages(
  filePath: string
): Promise<{ success: boolean; data?: PageExtractionResult; error?: string }> {
  try {
    await fs.access(filePath);
  } catch {
    return { success: false, error: "PDF file not found or path is invalid" };
  }

  let parser: PDFParse | null = null;

  try {
    const buffer = await fs.readFile(filePath);
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    const rawPages = (result as { pages?: Array<{ num: number; text: string }> })
      .pages;

    if (rawPages && rawPages.length > 0) {
      let lineOffset = 0;
      const pages: PageContent[] = rawPages.map((page) => {
        const text = page.text?.trim() ?? "";
        const lineCount = text ? text.split(/\r?\n/).length : 0;
        const pageContent: PageContent = {
          pageNumber: page.num,
          text,
          lineStart: lineOffset,
          lineEnd: lineOffset + Math.max(lineCount - 1, 0),
        };
        lineOffset += lineCount + 1;
        return pageContent;
      });

      const fullText = pages.map((p) => p.text).filter(Boolean).join("\n\n");

      return {
        success: true,
        data: {
          pages,
          fullText: fullText.trim(),
          totalPages:
            (result as { total?: number }).total ?? pages.length,
        },
      };
    }

    const fullText = result.text?.trim() ?? "";
    if (!fullText) {
      return { success: false, error: "PDF contains no extractable text" };
    }

    const pages = splitTextIntoEstimatedPages(fullText);
    return {
      success: true,
      data: { pages, fullText, totalPages: pages.length },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown PDF page extraction error";
    return { success: false, error: `PDF page extraction failed: ${message}` };
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Best-effort cleanup
      }
    }
  }
}

/** Split plain text into pages using form-feed markers or paragraph groups */
export function splitTextIntoEstimatedPages(text: string): PageContent[] {
  const formFeedParts = text.split(/\f/);

  if (formFeedParts.length > 1) {
    let lineOffset = 0;
    return formFeedParts
      .map((part, index) => {
        const trimmed = part.trim();
        const lineCount = trimmed ? trimmed.split(/\r?\n/).length : 0;
        const page: PageContent = {
          pageNumber: index + 1,
          text: trimmed,
          lineStart: lineOffset,
          lineEnd: lineOffset + Math.max(lineCount - 1, 0),
        };
        lineOffset += lineCount + 1;
        return page;
      })
      .filter((p) => p.text.length > 0);
  }

  const lines = text.split(/\r?\n/);
  const linesPerPage = 45;
  const pages: PageContent[] = [];

  for (let i = 0; i < lines.length; i += linesPerPage) {
    const pageLines = lines.slice(i, i + linesPerPage);
    const pageText = pageLines.join("\n").trim();
    if (!pageText) continue;

    pages.push({
      pageNumber: pages.length + 1,
      text: pageText,
      lineStart: i,
      lineEnd: i + pageLines.length - 1,
    });
  }

  if (pages.length === 0 && text.trim()) {
    pages.push({
      pageNumber: 1,
      text: text.trim(),
      lineStart: 0,
      lineEnd: lines.length - 1,
    });
  }

  return pages;
}

/** Convert extraction API pages to PageContent with line offsets */
export function mapExtractionPagesToContent(
  pages: PageExtractionData[]
): PageContent[] {
  let lineOffset = 0;
  return pages.map((page) => {
    const lineCount = page.text ? page.text.split(/\r?\n/).length : 0;
    const content: PageContent = {
      pageNumber: page.pageNumber,
      text: page.text,
      lineStart: lineOffset,
      lineEnd: lineOffset + Math.max(lineCount - 1, 0),
    };
    lineOffset += lineCount + 1;
    return content;
  });
}

/** Resolve page number for a given line index */
export function resolvePageForLine(
  pages: PageContent[],
  lineIndex: number
): { pageNumber: number; pageOffset: number } | undefined {
  for (const page of pages) {
    if (lineIndex >= page.lineStart && lineIndex <= page.lineEnd) {
      return {
        pageNumber: page.pageNumber,
        pageOffset: lineIndex - page.lineStart,
      };
    }
  }
  return pages.length > 0
    ? { pageNumber: pages[pages.length - 1].pageNumber, pageOffset: 0 }
    : undefined;
}

/** Resolve page range spanning line start/end */
export function resolvePageRange(
  pages: PageContent[],
  lineStart: number,
  lineEnd: number
): { start: number; end: number } | undefined {
  const startPage = resolvePageForLine(pages, lineStart)?.pageNumber;
  const endPage = resolvePageForLine(pages, lineEnd)?.pageNumber;

  if (startPage === undefined || endPage === undefined) return undefined;
  return { start: startPage, end: endPage };
}
