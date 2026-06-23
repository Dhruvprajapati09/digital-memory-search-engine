import path from "path";
import DocumentModel, { IDocument } from "../models/Document";
import { UPLOAD_DIR } from "../middleware/upload";
import { extractPdfText } from "./pdfExtractor";
import { extractImageText } from "./ocrExtractor";
import { cleanText } from "./textCleaner";
import type { ExtractionResult } from "../types/extraction.types";

/** Resolve a stored filename to a safe absolute path inside uploads/ */
export function resolveSafeUploadPath(storedFileName: string): string {
  const absolutePath = path.resolve(UPLOAD_DIR, storedFileName);
  const uploadsWithSep = UPLOAD_DIR.endsWith(path.sep)
    ? UPLOAD_DIR
    : `${UPLOAD_DIR}${path.sep}`;

  if (!absolutePath.startsWith(uploadsWithSep)) {
    throw new Error("Invalid file path");
  }

  return absolutePath;
}

/**
 * Route extraction to the correct extractor based on document type.
 * Returns cleaned text ready for MongoDB storage and future embedding pipelines.
 */
export async function extractTextFromDocument(
  document: IDocument
): Promise<ExtractionResult> {
  if (document.type === "note") {
    const text = cleanText(document.noteContent ?? "");
    if (!text) {
      return { success: false, error: "Note content is empty" };
    }
    return { success: true, text };
  }

  if (!document.storedFileName) {
    return { success: false, error: "No file associated with this document" };
  }

  const filePath = resolveSafeUploadPath(document.storedFileName);

  let result: ExtractionResult;

  if (document.type === "pdf") {
    result = await extractPdfText(filePath);
  } else if (document.type === "image") {
    result = await extractImageText(filePath);
  } else {
    return { success: false, error: "Unsupported document type for extraction" };
  }

  if (!result.success || !result.text) {
    return result;
  }

  return { success: true, text: cleanText(result.text) };
}

/**
 * Run the full extraction pipeline for a document and persist results.
 * Safe to call from background jobs — never throws to callers.
 */
export async function runExtractionForDocument(
  documentId: string
): Promise<void> {
  try {
    const document = await DocumentModel.findById(documentId);

    if (!document) {
      return;
    }

    document.extractionStatus = "processing";
    document.extractionError = null;
    await document.save();

    const result = await extractTextFromDocument(document);

    if (result.success && result.text) {
      document.extractedText = result.text;
      document.extractionStatus = "completed";
      document.extractionError = null;
    } else {
      document.extractionStatus = "failed";
      document.extractionError = result.error ?? "Extraction failed";
    }

    await document.save();
  } catch (err) {
    console.error(`Extraction failed for document ${documentId}:`, err);

    try {
      await DocumentModel.findByIdAndUpdate(documentId, {
        extractionStatus: "failed",
        extractionError:
          err instanceof Error ? err.message : "Unexpected extraction error",
      });
    } catch (updateErr) {
      console.error("Failed to update extraction error status:", updateErr);
    }
  }
}

/**
 * Queue extraction without blocking the HTTP response.
 */
export function queueExtraction(documentId: string): void {
  void runExtractionForDocument(documentId);
}
