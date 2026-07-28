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

/** In-memory OCR cache keyed by file path + mtime */
const ocrCache = new Map<string, { text: string; cachedAt: number }>();
const OCR_CACHE_TTL_MS = 60 * 60 * 1000;

async function getCacheKey(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath);
    return `${filePath}:${stat.mtimeMs}`;
  } catch {
    return null;
  }
}

/**
 * Extract text from images using Tesseract.js OCR.
 * Supports PNG, JPG, JPEG, and WEBP. Results are cached by file mtime.
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

  const cacheKey = await getCacheKey(filePath);
  if (cacheKey) {
    const cached = ocrCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < OCR_CACHE_TTL_MS) {
      return { success: true, text: cached.text };
    }
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

    if (cacheKey) {
      ocrCache.set(cacheKey, { text, cachedAt: Date.now() });
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

/** Clear OCR cache (for testing) */
export function clearOcrCache(): void {
  ocrCache.clear();
}
