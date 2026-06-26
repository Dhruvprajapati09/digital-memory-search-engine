import fs from "fs/promises";
import path from "path";
import type { ExtractionResult } from "../types/extraction.types";

const SUPPORTED_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".html",
  ".htm",
]);

export async function extractPlainText(
  filePath: string
): Promise<ExtractionResult> {
  try {
    await fs.access(filePath);
  } catch {
    return { success: false, error: "Text file not found or path is invalid" };
  }

  const ext = path.extname(filePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return {
      success: false,
      error: `Unsupported text file format: ${ext || "unknown"}`,
    };
  }

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .trim();

    if (!text) {
      return { success: false, error: "Text file contains no readable text" };
    }

    return { success: true, text };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown text extraction error";

    return {
      success: false,
      error: `Text extraction failed: ${message}`,
    };
  }
}
