import DocumentModel, { IDocument } from "../models/Document";
import ChunkModel from "../models/Chunk";
<<<<<<< HEAD
import { chunkTextByTopics } from "./chunking/topicChunkingService";
import {
=======
import VideoModel from "../models/Video";
import { chunkTextByTopics } from "./chunking/topicChunkingService";
import {
  chunkTranscriptByTopics,
  type TimestampedTopicChunk,
} from "./chunking/transcriptChunkingService";
import {
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
  enrichChunkMetadata,
  buildEmbeddingText,
  buildSearchableText,
} from "./enrichment/chunkEnrichmentService";
import { generateEmbeddingsBatch } from "./embeddingService";
import { vectorStore } from "./vectorStoreService";
import { env } from "../config/env";
import type { StoreVectorPayload, VectorMetadata } from "../types/embedding";
<<<<<<< HEAD

const EMBEDDING_BATCH_SIZE = 8;
=======
import type { TopicChunk } from "../types/chunking";
import { invalidateSummaryCache } from "./ai/summarizer";

const EMBEDDING_BATCH_SIZE = 8;

type IndexableChunk = TopicChunk & {
  videoMetadata?: TimestampedTopicChunk["videoMetadata"];
};

async function resolveChunksForDocument(
  document: IDocument | null
): Promise<IndexableChunk[]> {
  if (!document) return [];

  if (document.type === "video" && document.videoId) {
    const video = await VideoModel.findById(document.videoId);

    if (!video || video.transcriptSegments.length === 0) {
      return [];
    }

    return chunkTranscriptByTopics(video.transcriptSegments, {
      documentTitle: document.title,
      videoTitle: document.title,
      maxTokens: env.CHUNK_MAX_TOKENS,
      youtubeVideoId: video.videoId,
      channel: video.channel,
      videoUrl: video.url,
    });
  }

  return chunkTextByTopics(document.extractedText ?? "", {
    documentTitle: document.title,
    maxTokens: env.CHUNK_MAX_TOKENS,
  });
}

async function syncVideoStatusAfterIndexing(
  document: IDocument,
  chunkCount: number,
  failed: boolean,
  errorMessage?: string
): Promise<void> {
  if (document.type !== "video" || !document.videoId) return;

  await VideoModel.findByIdAndUpdate(document.videoId, {
    status: failed ? "failed" : "indexed",
    chunkCount,
    statusError: errorMessage ?? null,
  });
}
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)

/**
 * Orchestrates topic-based indexing:
 * structure parse → topic chunk → enrich → embed → store → link hierarchy.
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
      `[indexingService] Topic indexing started: ${documentId} (${document.title})`
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
      document.extractionStatus = "completed";
      document.extractionError = null;
    }

    document.indexStatus = "processing";
    document.indexError = null;
    await document.save();

    await vectorStore.deleteVectorsByDocument(
      documentId,
      document.userId.toString()
    );

<<<<<<< HEAD
    const topicChunks = chunkTextByTopics(extractedText, {
      documentTitle: document.title,
      maxTokens: env.CHUNK_MAX_TOKENS,
    });
=======
    const topicChunks = await resolveChunksForDocument(document);
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)

    console.log(
      `[indexingService] Topic chunks for ${documentId}: ${topicChunks.length}`
    );

    if (topicChunks.length === 0) {
      document.indexStatus = "failed";
      document.indexError = "Topic chunking produced no chunks";
      await document.save();
      await syncVideoStatusAfterIndexing(document, 0, true, document.indexError);
      return;
    }

    const enriched = topicChunks.map((chunk) => ({
      chunk,
      meta: enrichChunkMetadata(chunk),
    }));

    const embeddingTexts = enriched.map(({ chunk, meta }) =>
      buildEmbeddingText(chunk, meta)
    );

    console.log(
      `[indexingService] Generating embeddings (batch=${EMBEDDING_BATCH_SIZE}) for ${documentId}`
    );

    const embeddings = await generateEmbeddingsBatch(embeddingTexts, {
      taskType: { kind: "document" },
      batchSize: EMBEDDING_BATCH_SIZE,
      onProgress: (done, total) => {
        console.log(
          `[indexingService] Embeddings ${done}/${total} for ${documentId}`
        );
      },
    });

    const chunkIdByIndex = new Map<number, string>();
    let processedChunks = 0;
    const errors: string[] = [];

    for (let i = 0; i < enriched.length; i += 1) {
      try {
        const { chunk, meta } = enriched[i];
        const embedding = embeddings[i];
        const searchableText = buildSearchableText(chunk, meta);

<<<<<<< HEAD
        const metadata: VectorMetadata = {
          documentId,
          userId: document.userId.toString(),
          chunkIndex: chunk.chunkIndex,
          type: document.type,
          documentTitle: document.title,
          topic: meta.topic,
          subtopic: meta.subtopic,
          title: meta.title,
          summary: meta.summary,
          keywords: meta.keywords,
          concepts: meta.concepts,
          tags: meta.tags,
          sectionPath: meta.sectionPath,
          contentPreview: meta.contentPreview,
          level: meta.level,
          parentChunkIndex: meta.parentChunkIndex,
        };

        const payload: StoreVectorPayload = {
          vector: embedding.vector,
          text: chunk.text,
          searchableText,
          metadata,
          embeddingModel: embedding.model,
          tokenCount: chunk.tokenCount,
=======
        const videoMeta =
          "videoMetadata" in chunk
            ? (chunk as IndexableChunk).videoMetadata
            : undefined;

        const metadata: VectorMetadata = {
          documentId,
          userId: document.userId.toString(),
          chunkIndex: chunk.chunkIndex,
          type: document.type,
          documentTitle: document.title,
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
          topic: meta.topic,
          subtopic: meta.subtopic,
          title: meta.title,
          summary: meta.summary,
          keywords: meta.keywords,
          concepts: meta.concepts,
          tags: meta.tags,
<<<<<<< HEAD
          sourceType: document.type,
=======
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
          sectionPath: meta.sectionPath,
          contentPreview: meta.contentPreview,
          level: meta.level,
          parentChunkIndex: meta.parentChunkIndex,
<<<<<<< HEAD
        };

=======
          ...(videoMeta
            ? {
                sourceType: "video",
                youtubeVideoId: videoMeta.youtubeVideoId,
                videoUrl: videoMeta.videoUrl,
                channel: videoMeta.channel,
                startSeconds: videoMeta.startSeconds,
                endSeconds: videoMeta.endSeconds,
                startTimeFormatted: videoMeta.startTimeFormatted,
                endTimeFormatted: videoMeta.endTimeFormatted,
                timestampSeconds: videoMeta.startSeconds,
                timestampFormatted: videoMeta.startTimeFormatted,
              }
            : {}),
        };

        const payload: StoreVectorPayload = {
          vector: embedding.vector,
          text: chunk.text,
          searchableText,
          metadata,
          embeddingModel: embedding.model,
          tokenCount: chunk.tokenCount,
          topic: meta.topic,
          subtopic: meta.subtopic,
          title: meta.title,
          summary: meta.summary,
          keywords: meta.keywords,
          concepts: meta.concepts,
          tags: meta.tags,
          sourceType: document.type,
          sectionPath: meta.sectionPath,
          contentPreview: meta.contentPreview,
          level: meta.level,
          parentChunkIndex: meta.parentChunkIndex,
        };

>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
        const vectorId = await vectorStore.storeVector(payload);
        chunkIdByIndex.set(chunk.chunkIndex, vectorId);
        processedChunks += 1;
      } catch (chunkErr) {
        const message =
          chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
        errors.push(`chunk ${i}: ${message}`);
        console.error(
          `[indexingService] Chunk ${i} failed for ${documentId}:`,
          chunkErr
        );
      }
    }

    // Link parentChunkId after all chunks are stored
    for (const { chunk } of enriched) {
      if (chunk.parentChunkIndex === undefined) continue;

      const childId = chunkIdByIndex.get(chunk.chunkIndex);
      const parentId = chunkIdByIndex.get(chunk.parentChunkIndex);

      if (childId && parentId) {
        await ChunkModel.findByIdAndUpdate(childId, {
          parentChunkId: parentId,
        });
      }
    }

    if (processedChunks === 0) {
      document.indexStatus = "failed";
      document.indexError = errors.join("; ") || "All chunks failed to index";
      await document.save();
<<<<<<< HEAD
=======
      await syncVideoStatusAfterIndexing(
        document,
        0,
        true,
        document.indexError
      );
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
      return;
    }

    document.indexStatus = "indexed";
    document.indexedAt = new Date();
    document.chunkCount = processedChunks;
    document.embeddingModel = env.MISTRAL_EMBEDDING_MODEL;
    document.indexError =
      errors.length > 0
        ? `Partial index: ${errors.length} chunk(s) failed`
        : null;
    await document.save();

    await syncVideoStatusAfterIndexing(document, processedChunks, false);

    invalidateSummaryCache(documentId);

    console.log(
      `[indexingService] Indexed ${processedChunks}/${topicChunks.length} topic chunks: ${documentId}`
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

export async function reindexDocument(documentId: string): Promise<void> {
  await runReindexForDocument(documentId);
}

export function queueIndexing(documentId: string): void {
  void runIndexingForDocument(documentId);
}

export function queueReindex(documentId: string): void {
  void runReindexForDocument(documentId);
}

export async function getDocumentChunks(documentId: string, userId: string) {
  return ChunkModel.find({ documentId, userId })
    .sort({ chunkIndex: 1 })
    .select("-embedding -searchableText")
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
