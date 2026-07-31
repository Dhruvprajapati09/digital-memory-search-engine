import mongoose from "mongoose";
import PageIndexModel from "../../models/PageIndex";
import DocumentModel, { type IDocument } from "../../models/Document";
import type { PageExtractionData } from "../../types/extraction.types";

function resolveDocumentName(doc: IDocument): string {
  return doc.originalFileName ?? doc.title ?? "Untitled";
}

function buildPagesFromDocument(doc: IDocument): PageExtractionData[] {
  const pages =
    doc.extractedPages?.filter((page) => page.text.trim().length > 0) ?? [];

  if (pages.length > 0) {
    return pages;
  }

  const fallbackText = (doc.extractedText ?? doc.noteContent ?? "").trim();
  if (!fallbackText) {
    return [];
  }

  return [{ pageNumber: 1, text: fallbackText }];
}

/**
 * Replace PageIndex rows for a document from its extracted page text.
 * Safe to call after extraction completes.
 */
export async function upsertPageIndexForDocument(
  document: IDocument
): Promise<number> {
  const documentId = document._id.toString();
  const userId = document.userId.toString();
  const pages = buildPagesFromDocument(document);

  await PageIndexModel.deleteMany({
    documentId: new mongoose.Types.ObjectId(documentId),
  });

  if (pages.length === 0) {
    return 0;
  }

  const documentName = resolveDocumentName(document);
  const ops = pages.map((page) => ({
    updateOne: {
      filter: {
        userId: new mongoose.Types.ObjectId(userId),
        documentId: new mongoose.Types.ObjectId(documentId),
        pageNumber: page.pageNumber,
      },
      update: {
        $set: {
          userId: new mongoose.Types.ObjectId(userId),
          documentId: new mongoose.Types.ObjectId(documentId),
          pageNumber: page.pageNumber,
          text: page.text,
          documentName,
          title: document.title,
          type: document.type,
          storedFileName: document.storedFileName,
          documentCreatedAt: document.createdAt,
        },
      },
      upsert: true,
    },
  }));

  await PageIndexModel.bulkWrite(ops, { ordered: false });
  return pages.length;
}

/** Remove all PageIndex rows for a document. */
export async function deletePageIndexForDocument(
  documentId: string
): Promise<number> {
  const result = await PageIndexModel.deleteMany({
    documentId: new mongoose.Types.ObjectId(documentId),
  });
  return result.deletedCount ?? 0;
}

/**
 * Backfill PageIndex from all documents with completed extraction.
 * Returns number of documents processed and pages written.
 */
export async function backfillPageIndex(options?: {
  userId?: string;
}): Promise<{ documents: number; pages: number }> {
  const filter: Record<string, unknown> = {
    extractionStatus: "completed",
  };

  if (options?.userId) {
    filter.userId = new mongoose.Types.ObjectId(options.userId);
  }

  const docs = await DocumentModel.find(filter);
  let documents = 0;
  let pages = 0;

  for (const doc of docs) {
    const written = await upsertPageIndexForDocument(doc);
    if (written > 0) {
      documents += 1;
      pages += written;
    }
  }

  return { documents, pages };
}
