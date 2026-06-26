import DocumentModel from "../models/Document";
import ChunkModel from "../models/Chunk";
import { chunkText } from "./chunkingService";
import { generateEmbedding } from "./embeddingService";
import { vectorStore } from "./vectorStoreService";
import { calculateTokens } from "../utils/tokenCounter";
import { env } from "../config/env";
import type { VectorMetadata } from "../types/embedding";

/**
 * Orchestrates the full indexing pipeline:
 * chunk → embed → store vector → save metadata → update document status.
 */
export async function runIndexingForDocument(
  documentId: string
): Promise<void> {
  try {
    const document = await DocumentModel.findById(documentId);

    if (!document) {
      console.warn(`[indexingService] Document not found: ${documentId}`);
      return;
    }

    console.log(
      `[indexingService] Document processing started: ${documentId} (${document.title})`
    );

    const extractedText = document.extractedText?.trim();

    if (!extractedText) {
      document.indexStatus = "failed";
      document.indexError =
        document.extractionStatus !== "completed"
          ? "Cannot index document until text extraction is completed"
          : "No extracted text available for indexing";
      await document.save();
      return;
    }

    if (document.extractionStatus !== "completed") {
      // Allow indexing when text exists (e.g. legacy records) but normalize status
      document.extractionStatus = "completed";
      document.extractionError = null;
    }

    document.indexStatus = "processing";
    document.indexError = null;
    await document.save();

    // Remove previous index data before rebuilding
    await vectorStore.deleteVectorsByDocument(
      documentId,
      document.userId.toString()
    );

    const textChunks = chunkText(extractedText);
    console.log(
      `[indexingService] Chunk count for ${documentId}: ${textChunks.length}`
    );

    if (textChunks.length === 0) {
      document.indexStatus = "failed";
      document.indexError = "Text chunking produced no chunks";
      await document.save();
      return;
    }

    console.log(
      `[indexingService] Embedding generation started for ${documentId}`
    );

    let processedChunks = 0;
    let embeddingModel = env.EMBEDDING_MODEL;

    for (const chunk of textChunks) {
      const tokenCount = calculateTokens(chunk.text);

      const embedding = await generateEmbedding(chunk.text);
      embeddingModel = embedding.model;

      const metadata: VectorMetadata = {
        documentId: documentId,
        userId: document.userId.toString(),
        chunkIndex: chunk.chunkIndex,
        type: document.type,
        documentTitle: document.title,
      };

      await vectorStore.storeVector({
        vector: embedding.vector,
        text: chunk.text,
        metadata,
        embeddingModel: embedding.model,
        tokenCount,
      });

      processedChunks += 1;
    }

    console.log(
      `[indexingService] Embedding generation completed for ${documentId} (${processedChunks} chunks)`
    );

    document.indexStatus = "indexed";
    document.indexedAt = new Date();
    document.chunkCount = processedChunks;
    document.embeddingModel = embeddingModel;
    document.indexError = null;
    await document.save();

    console.log(
      `[indexingService] Document indexed successfully: ${documentId}`
    );
  } catch (err) {
    console.error(`[indexingService] Indexing failed for ${documentId}:`, err);

    try {
      await DocumentModel.findByIdAndUpdate(documentId, {
        indexStatus: "failed",
        indexError:
          err instanceof Error ? err.message : "Unexpected indexing error",
      });
    } catch (updateErr) {
      console.error(
        "[indexingService] Failed to update index error status:",
        updateErr
      );
    }
  }
}

/**
 * Rebuild the search index: extract text if needed, then chunk + embed.
 */
export async function runReindexForDocument(
  documentId: string
): Promise<void> {
  try {
    const document = await DocumentModel.findById(documentId);

    if (!document) {
      console.warn(`[indexingService] Document not found: ${documentId}`);
      return;
    }

    await vectorStore.deleteVectorsByDocument(
      documentId,
      document.userId.toString()
    );

    document.indexStatus = "processing";
    document.indexError = null;
    document.chunkCount = 0;
    document.indexedAt = undefined;
    await document.save();

    const needsExtraction =
      document.extractionStatus !== "completed" ||
      !document.extractedText?.trim();

    if (needsExtraction) {
      console.log(
        `[indexingService] Running extraction before reindex: ${documentId}`
      );

      const { runExtractionForDocument } = await import("./extractionService");

      const extracted = await runExtractionForDocument(documentId, {
        skipAutoIndex: true,
      });

      if (!extracted) {
        const updated = await DocumentModel.findById(documentId);
        if (updated) {
          updated.indexStatus = "failed";
          updated.indexError =
            updated.extractionError ??
            "Text extraction must complete before indexing";
          await updated.save();
        }
        return;
      }
    }

    await runIndexingForDocument(documentId);
  } catch (err) {
    console.error(`[indexingService] Reindex failed for ${documentId}:`, err);

    try {
      await DocumentModel.findByIdAndUpdate(documentId, {
        indexStatus: "failed",
        indexError:
          err instanceof Error ? err.message : "Unexpected reindex error",
      });
    } catch (updateErr) {
      console.error(
        "[indexingService] Failed to update reindex error status:",
        updateErr
      );
    }
  }
}

/**
 * Rebuild the search index from scratch for a document (synchronous).
 */
export async function reindexDocument(documentId: string): Promise<void> {
  await runReindexForDocument(documentId);
}

export function queueIndexing(documentId: string): void {
  void runIndexingForDocument(documentId);
}

export function queueReindex(documentId: string): void {
  void runReindexForDocument(documentId);
}

export async function getDocumentChunks(
  documentId: string,
  userId: string
) {
  return ChunkModel.find({ documentId, userId })
    .sort({ chunkIndex: 1 })
    .select("-embedding")
    .lean();
}

export async function getUserChunkCount(userId: string): Promise<number> {
  return ChunkModel.countDocuments({ userId });
}

export async function deleteDocumentIndex(
  documentId: string,
  userId: string
): Promise<void> {
  await vectorStore.deleteVectorsByDocument(documentId, userId);
}
