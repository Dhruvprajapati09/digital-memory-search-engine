import fs from "fs/promises";
import path from "path";
import Tesseract from "tesseract.js";
import type { ExtractionResult } from "../types/extraction.types";

const SUPPORTED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

/**
 * Extract text from images using Tesseract.js OCR.
 * Supports PNG, JPG, JPEG, and WEBP.
 */
export async function extractImageText(filePath: string): Promise<ExtractionResult> {
  try {
    await fs.access(filePath);
  } catch {
    return { success: false, error: "Image file not found or path is invalid" };
  }

  const ext = path.extname(filePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return {
      success: false,
      error: `Unsupported image format: ${ext || "unknown"}`,
    };
  }

  try {
    const result = await Tesseract.recognize(filePath, "eng", {
      logger: () => {
        // Suppress verbose OCR logs in production
      },
    });

    const text = result.data.text?.trim() ?? "";

    if (!text) {
      return {
        success: false,
        error: "No text detected in image. The image may be empty or too blurry.",
      };
    }

    return { success: true, text };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown OCR extraction error";

    return {
      success: false,
      error: `OCR extraction failed: ${message}`,
    };
  }
}
