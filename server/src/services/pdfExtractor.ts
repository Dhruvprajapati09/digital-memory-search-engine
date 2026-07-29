import fs from "fs/promises";
import { PDFParse } from "pdf-parse";
import type { ExtractionResult } from "../types/extraction.types";

/**
 * Extract plain text from a PDF file using pdf-parse.
 * Returns page-aware data when available.
 */
export async function extractPdfText(filePath: string): Promise<ExtractionResult> {
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
    const text = result.text?.trim() ?? "";

    if (!text) {
      return {
        success: false,
        error: "PDF contains no extractable text",
      };
    }

    const rawPages = (result as { pages?: Array<{ num: number; text: string }> })
      .pages;
    const totalPages = (result as { total?: number }).total;

    const pages =
      rawPages && rawPages.length > 0
        ? rawPages.map((p) => ({
            pageNumber: p.num,
            text: p.text?.trim() ?? "",
          }))
        : undefined;

    return {
      success: true,
      text,
      pages,
      totalPages: totalPages ?? pages?.length,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown PDF extraction error";

    return {
      success: false,
      error: `PDF extraction failed: ${message}`,
    };
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
