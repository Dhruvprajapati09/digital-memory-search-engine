import DocumentModel, { IDocument } from "../models/Document";
import ChunkModel from "../models/Chunk";
import VideoModel from "../models/Video";
import { chunkTextByTopics } from "./chunking/topicChunkingService";
import {
  chunkTranscriptByTopics,
  type TimestampedTopicChunk,
} from "./chunking/transcriptChunkingService";
import { buildEmbeddingText } from "./enrichment/chunkEnrichmentService";
import { generateEmbeddingsBatch } from "./embeddingService";
import { vectorStore } from "./vectorStoreService";
import { env } from "../config/env";
import type { StoreVectorPayload, VectorMetadata } from "../types/embedding";
import type { TopicChunk } from "../types/chunking";
import type {
  DocumentIntelligenceResult,
  SemanticChunk,
} from "../types/documentIntelligence";
import { invalidateSummaryCache } from "./ai/summarizer";
import {
  runDocumentIntelligencePipeline,
  isDocumentIntelligenceEnabled,
} from "./indexing/documentIntelligencePipeline";
import { enrichAllSemanticChunks } from "./indexing/metadataEnrichmentService";
import {
  planIncrementalIndex,
  getChunksNeedingEmbeddings,
} from "./indexing/incrementalIndexingService";
import {
  buildKnowledgeGraphData,
  persistKnowledgeGraph,
  deleteKnowledgeGraph,
} from "./indexing/knowledgeGraphService";
import { validateDocumentIndex } from "./indexing/indexValidationService";
import { resolveSafeUploadPath } from "./extractionService";

type IndexableChunk = TopicChunk & {
  videoMetadata?: TimestampedTopicChunk["videoMetadata"];
};

function chunkPdfPagesByTopics(document: IDocument): SemanticChunk[] {
  const pages =
    document.extractedPages?.filter((page) => page.text.trim().length > 0) ??
    [];

  if (document.type !== "pdf" || pages.length === 0) {
    return [];
  }

  const chunks: SemanticChunk[] = [];

  for (const page of pages) {
    const pageChunks = chunkTextByTopics(page.text, {
      documentTitle: document.title,
      maxTokens: env.CHUNK_MAX_TOKENS,
    });

    for (const chunk of pageChunks) {
      chunks.push({
        ...chunk,
        chunkIndex: chunks.length,
        pageNumber: page.pageNumber,
        pageRange: { start: page.pageNumber, end: page.pageNumber },
        sourcePage: page.pageNumber,
      });
    }
  }

  return chunks;
}

async function resolveFilePath(document: IDocument): Promise<string | undefined> {
  if (!document.storedFileName) return undefined;
  try {
    return resolveSafeUploadPath(document.storedFileName);
  } catch {
    return undefined;
  }
}

async function resolveSemanticChunks(
  document: IDocument
): Promise<{
  chunks: SemanticChunk[];
  intelligence?: DocumentIntelligenceResult;
}> {
  const extractedText = document.extractedText?.trim() ?? "";

  if (document.type === "video" && document.videoId) {
    const video = await VideoModel.findById(document.videoId);
    if (!video || video.transcriptSegments.length === 0) {
      return { chunks: [] };
    }

    const transcriptChunks = chunkTranscriptByTopics(video.transcriptSegments, {
      documentTitle: document.title,
      videoTitle: document.title,
      maxTokens: env.CHUNK_MAX_TOKENS,
      youtubeVideoId: video.videoId,
      channel: video.channel,
      videoUrl: video.url,
    });

    return {
      chunks: transcriptChunks.map((chunk) => ({
        ...chunk,
      })) as SemanticChunk[],
    };
  }

  if (isDocumentIntelligenceEnabled()) {
    const filePath = await resolveFilePath(document);
    const intelligence = await runDocumentIntelligencePipeline({
      documentId: document._id.toString(),
      userId: document.userId.toString(),
      title: document.title,
      sourceType: document.type,
      extractedText,
      filePath,
    }, {
      preExtractedPages: document.extractedPages,
      totalPages: document.totalPages,
    });
    return { chunks: intelligence.chunks, intelligence };
  }

  const pageAwarePdfChunks = chunkPdfPagesByTopics(document);
  if (pageAwarePdfChunks.length > 0) {
    return { chunks: pageAwarePdfChunks };
  }

  return {
    chunks: chunkTextByTopics(extractedText, {
      documentTitle: document.title,
      maxTokens: env.CHUNK_MAX_TOKENS,
    }) as SemanticChunk[],
  };
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

function buildStorePayload(
  document: IDocument,
  chunk: SemanticChunk,
  enrichmentResult: ReturnType<typeof enrichAllSemanticChunks>[number],
  embedding: { vector: number[]; model: string },
  videoMeta?: TimestampedTopicChunk["videoMetadata"]
): StoreVectorPayload {
  const { enrichment, fields, searchableText } = enrichmentResult;

  const metadata: VectorMetadata = {
    documentId: document._id.toString(),
    userId: document.userId.toString(),
    chunkIndex: chunk.chunkIndex,
    type: document.type,
    documentTitle: document.title,
    documentName: document.originalFileName ?? document.title,
    originalFileName: document.originalFileName,
    filePath: document.filePath,
    fileUrl: document.storedFileName
      ? `/uploads/${document.storedFileName}`
      : undefined,
    topic: enrichment.topic,
    subtopic: enrichment.subtopic,
    title: enrichment.title,
    summary: enrichment.summary,
    keywords: fields.keywords,
    concepts: fields.concepts,
    tags: fields.tags,
    sectionPath: enrichment.sectionPath,
    contentPreview: enrichment.contentPreview,
    level: enrichment.level,
    parentChunkIndex: enrichment.parentChunkIndex,
    chapter: chunk.chapter,
    section: chunk.section,
    heading: chunk.heading,
    parentHeading: chunk.parentHeading,
    pageNumber: chunk.pageNumber,
    pageRange: chunk.pageRange,
    language: fields.language,
    embeddingVersion: fields.embeddingVersion,
    chunkHash: fields.chunkHash,
    indexVersion: fields.indexVersion,
    entities: fields.entities,
    relationships: fields.relationships,
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

  return {
    vector: embedding.vector,
    text: chunk.text,
    searchableText,
    metadata,
    embeddingModel: embedding.model,
    tokenCount: chunk.tokenCount,
    topic: enrichment.topic,
    subtopic: enrichment.subtopic,
    title: enrichment.title,
    summary: fields.summary,
    keywords: fields.keywords,
    concepts: fields.concepts,
    tags: fields.tags,
    sourceType: videoMeta ? "video" : document.type,
    sectionPath: enrichment.sectionPath,
    contentPreview: enrichment.contentPreview,
    level: enrichment.level,
    parentChunkIndex: enrichment.parentChunkIndex,
    chapter: chunk.chapter,
    section: chunk.section,
    heading: chunk.heading,
    parentHeading: chunk.parentHeading,
    pageNumber: chunk.pageNumber,
    pageRange: chunk.pageRange,
    pageOffset: chunk.pageOffset,
    sourcePage: chunk.sourcePage,
    entities: fields.entities,
    relationships: fields.relationships,
    language: fields.language,
    embeddingVersion: fields.embeddingVersion,
    embeddingDate: fields.embeddingDate,
    chunkHash: fields.chunkHash,
    indexVersion: fields.indexVersion,
  };
}

async function processChunksInParallel<T>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<void>
): Promise<void> {
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      await processor(items[current], current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
}

/**
 * Orchestrates document intelligence indexing:
 * structure → semantic chunk → enrich → embed → store → graph → validate.
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
      `[indexingService] Indexing started: ${documentId} (${document.title})`
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

    const userId = document.userId.toString();
    const embeddingModel = env.MISTRAL_EMBEDDING_MODEL;

    // Resolve semantic chunks via Phase 5 pipeline or legacy chunking
    const { chunks: semanticChunks, intelligence } =
      await resolveSemanticChunks(document);

    console.log(
      `[indexingService] Chunks for ${documentId}: ${semanticChunks.length}`
    );

    if (semanticChunks.length === 0) {
      document.indexStatus = "failed";
      document.indexError = "Chunking produced no chunks";
      await document.save();
      await syncVideoStatusAfterIndexing(document, 0, true, document.indexError);
      return;
    }

    // Incremental indexing plan
    const indexPlan = await planIncrementalIndex(
      documentId,
      userId,
      semanticChunks,
      embeddingModel
    );

    if (!env.ENABLE_INCREMENTAL_INDEXING || indexPlan.isFullReindex) {
      await vectorStore.deleteVectorsByDocument(documentId, userId);
      await deleteKnowledgeGraph(documentId, userId);
    } else {
      for (const removed of indexPlan.removed) {
        await vectorStore.deleteVector(removed.vectorId, userId);
      }
    }

    const chunksToProcess = getChunksNeedingEmbeddings(indexPlan);

    const enrichedAll = enrichAllSemanticChunks(chunksToProcess, embeddingModel);

    const embeddingTexts = enrichedAll.map(({ chunk, enrichment }) =>
      buildEmbeddingText(chunk, enrichment)
    );

    console.log(
      `[indexingService] Generating embeddings (batch=${env.MISTRAL_EMBEDDING_BATCH_SIZE}) for ${chunksToProcess.length} new/changed chunks`
    );

    const embeddingMap = new Map<number, { vector: number[]; model: string }>();

    if (embeddingTexts.length > 0) {
      const embeddings = await generateEmbeddingsBatch(embeddingTexts, {
        taskType: { kind: "document" },
        batchSize: env.MISTRAL_EMBEDDING_BATCH_SIZE,
        onProgress: (done, total) => {
          console.log(
            `[indexingService] Embeddings ${done}/${total} for ${documentId}`
          );
        },
      });

      for (let i = 0; i < enrichedAll.length; i += 1) {
        embeddingMap.set(enrichedAll[i].chunk.chunkIndex, embeddings[i]);
      }
    }

    const chunkIdByIndex = new Map<number, string>();

    for (const unchanged of indexPlan.unchanged) {
      chunkIdByIndex.set(unchanged.chunkIndex, unchanged.vectorId);
    }

    let processedChunks = indexPlan.unchanged.length;
    const errors: string[] = [];

    const storeTasks = enrichedAll.filter(({ chunk }) =>
      embeddingMap.has(chunk.chunkIndex)
    );

    await processChunksInParallel(
      storeTasks,
      env.INDEXING_CONCURRENCY,
      async ({ chunk, ...enrichment }) => {
        try {
          const embedding = embeddingMap.get(chunk.chunkIndex);
          if (!embedding) return;

          const videoMeta =
            "videoMetadata" in chunk
              ? (chunk as IndexableChunk).videoMetadata
              : undefined;

          const payload = buildStorePayload(
            document,
            chunk,
            { chunk, ...enrichment },
            embedding,
            videoMeta
          );

          const existingVectorId = (chunk as SemanticChunk & { existingVectorId?: string })
            .existingVectorId;

          let vectorId: string;
          if (existingVectorId && env.ENABLE_INCREMENTAL_INDEXING) {
            await vectorStore.updateVector(existingVectorId, payload);
            vectorId = existingVectorId;
          } else {
            vectorId = await vectorStore.storeVector(payload);
          }

          chunkIdByIndex.set(chunk.chunkIndex, vectorId);
          processedChunks += 1;
        } catch (chunkErr) {
          const message =
            chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
          errors.push(`chunk ${chunk.chunkIndex}: ${message}`);
          console.error(
            `[indexingService] Chunk ${chunk.chunkIndex} failed for ${documentId}:`,
            chunkErr
          );
        }
      }
    );

    // Link parentChunkId after all chunks are stored
    for (const chunk of semanticChunks) {
      if (chunk.parentChunkIndex === undefined) continue;

      const childId = chunkIdByIndex.get(chunk.chunkIndex);
      const parentId = chunkIdByIndex.get(chunk.parentChunkIndex);

      if (childId && parentId) {
        await ChunkModel.findByIdAndUpdate(childId, {
          parentChunkId: parentId,
        });
      }
    }

    // Knowledge graph
    if (isDocumentIntelligenceEnabled() && intelligence) {
      const graphData = buildKnowledgeGraphData(
        documentId,
        userId,
        document.title,
        intelligence.chunks,
        intelligence.entities,
        intelligence.relationships
      );

      await persistKnowledgeGraph(
        documentId,
        userId,
        graphData.nodes,
        graphData.edges
      );
    }

    if (processedChunks === 0) {
      document.indexStatus = "failed";
      document.indexError = errors.join("; ") || "All chunks failed to index";
      await document.save();
      await syncVideoStatusAfterIndexing(document, 0, true, document.indexError);
      return;
    }

    document.indexStatus = "indexed";
    document.indexedAt = new Date();
    document.chunkCount = processedChunks;
    document.embeddingModel = embeddingModel;
    document.indexError =
      errors.length > 0
        ? `Partial index: ${errors.length} chunk(s) failed`
        : null;
    await document.save();

    await syncVideoStatusAfterIndexing(document, processedChunks, false);

    invalidateSummaryCache(documentId);

    // Index validation
    if (env.ENABLE_INDEX_VALIDATION) {
      const report = await validateDocumentIndex(documentId, userId);
      if (!report.valid) {
        console.warn(
          `[indexingService] Validation issues for ${documentId}:`,
          report.issues.filter((i) => i.severity === "error").length,
          "errors"
        );
      }
    }

    console.log(
      `[indexingService] Indexed ${processedChunks}/${semanticChunks.length} chunks (${indexPlan.unchanged.length} reused): ${documentId}`
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
    await deleteKnowledgeGraph(
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
  await deleteKnowledgeGraph(documentId, userId);
}

export { validateDocumentIndex } from "./indexing/indexValidationService";
