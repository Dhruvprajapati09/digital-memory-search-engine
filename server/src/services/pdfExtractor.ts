import fs from "fs/promises";
import { PDFParse } from "pdf-parse";
import type { ExtractionResult } from "../types/extraction.types";

/**
 * Extract plain text from a PDF file using pdf-parse.
 */
export async function extractPdfText(filePath: string): Promise<ExtractionResult> {
  try {
    await fs.access(filePath);
  } catch {
    return { success: false, error: "PDF file not found or path is invalid" };
  }

  try {
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";

    if (!text) {
      return {
        success: false,
        error: "PDF contains no extractable text",
      };
    }

    return { success: true, text };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown PDF extraction error";

    return {
      success: false,
      error: `PDF extraction failed: ${message}`,
    };
  }
}
