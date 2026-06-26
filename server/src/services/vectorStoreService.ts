import mongoose from "mongoose";
import ChunkModel, { IChunk } from "../models/Chunk";
import {
  upsertVectors,
  queryVectors,
  deleteVectorsByIds,
  deleteVectorsByDocumentFilter,
  deleteVectorById,
  buildPineconeFilter,
} from "./pinecone/pineconeService";
import type { PineconeChunkMetadata } from "../types/pinecone";
import type {
  IVectorStore,
  StoreVectorPayload,
  VectorSearchQuery,
  VectorSearchResult,
  KeywordSearchQuery,
  KeywordSearchResult,
  VectorMetadata,
} from "../types/embedding";

function mapChunkToSearchResult(
  chunk: Record<string, unknown> & { score: number }
): VectorSearchResult {
<<<<<<< HEAD
  const metadata: VectorMetadata = {
    documentId: String(chunk.documentId),
    userId: String(chunk.userId),
    chunkIndex: chunk.chunkIndex as number,
    type: chunk.sourceType as string,
    documentTitle: (chunk.metadata as Record<string, unknown>)?.documentTitle as
      | string
      | undefined,
    topic: chunk.topic as string,
    subtopic: chunk.subtopic as string | undefined,
    title: chunk.title as string,
    summary: chunk.summary as string,
    keywords: chunk.keywords as string[],
    concepts: chunk.concepts as string[],
    tags: chunk.tags as string[],
    sectionPath: chunk.sectionPath as string[],
    contentPreview: chunk.contentPreview as string,
    level: chunk.level as string,
    parentChunkIndex: chunk.parentChunkIndex as number | undefined,
    parentChunkId: chunk.parentChunkId
      ? String(chunk.parentChunkId)
      : undefined,
  };

  return {
    vectorId: chunk.vectorId as string,
    score: chunk.score,
    text: chunk.text as string,
    metadata,
    topic: chunk.topic as string,
=======
  const storedMeta =
    (chunk.metadata as Record<string, unknown> | undefined) ?? {};

  const metadata: VectorMetadata = {
    documentId: String(chunk.documentId),
    userId: String(chunk.userId),
    chunkIndex: chunk.chunkIndex as number,
    type: (storedMeta.type as string) ?? (chunk.sourceType as string),
    documentTitle: storedMeta.documentTitle as string | undefined,
    topic: (chunk.topic as string) ?? (storedMeta.topic as string | undefined),
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
    subtopic: chunk.subtopic as string | undefined,
    title: chunk.title as string,
    summary: chunk.summary as string,
    keywords: chunk.keywords as string[],
<<<<<<< HEAD
    tags: chunk.tags as string[],
    sectionPath: chunk.sectionPath as string[],
    contentPreview: chunk.contentPreview as string,
  };
}

=======
    concepts: chunk.concepts as string[],
    tags: chunk.tags as string[],
    sectionPath: chunk.sectionPath as string[],
    contentPreview: chunk.contentPreview as string,
    level: chunk.level as string,
    parentChunkIndex: chunk.parentChunkIndex as number | undefined,
    parentChunkId: chunk.parentChunkId
      ? String(chunk.parentChunkId)
      : undefined,
    youtubeVideoId: storedMeta.youtubeVideoId as string | undefined,
    videoUrl: storedMeta.videoUrl as string | undefined,
    channel: storedMeta.channel as string | undefined,
    startSeconds: storedMeta.startSeconds as number | undefined,
    endSeconds: storedMeta.endSeconds as number | undefined,
    startTimeFormatted: storedMeta.startTimeFormatted as string | undefined,
    endTimeFormatted: storedMeta.endTimeFormatted as string | undefined,
    timestampSeconds: storedMeta.timestampSeconds as number | undefined,
    timestampFormatted: storedMeta.timestampFormatted as string | undefined,
  };

  return {
    vectorId: chunk.vectorId as string,
    score: chunk.score,
    text: chunk.text as string,
    metadata,
    topic: chunk.topic as string,
    subtopic: chunk.subtopic as string | undefined,
    title: chunk.title as string,
    summary: chunk.summary as string,
    keywords: chunk.keywords as string[],
    tags: chunk.tags as string[],
    sectionPath: chunk.sectionPath as string[],
    contentPreview: chunk.contentPreview as string,
  };
}

>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
function buildPineconeMetadata(
  payload: StoreVectorPayload
): PineconeChunkMetadata {
  return {
    userId: payload.metadata.userId,
    documentId: payload.metadata.documentId,
    chunkIndex: payload.metadata.chunkIndex,
    topic: payload.topic,
    subtopic: payload.subtopic ?? "",
    title: payload.title,
    sourceType: payload.sourceType,
    tags: (payload.tags ?? []).map((t) => t.toLowerCase()),
  };
}

/**
 * Hybrid vector store:
 * - Pinecone: embedding vectors + filter metadata
 * - MongoDB: full chunk text, enrichment fields, keyword/BM25 search
 */
class PineconeVectorStore implements IVectorStore {
  /**
   * Persist chunk in MongoDB, then upsert its embedding to Pinecone.
   * MongoDB _id becomes the Pinecone vector ID for 1:1 mapping.
   */
  async storeVector(payload: StoreVectorPayload): Promise<string> {
    const chunk = (await ChunkModel.create({
      documentId: payload.metadata.documentId,
      userId: payload.metadata.userId,
      chunkIndex: payload.metadata.chunkIndex,
      text: payload.text,
      tokenCount: payload.tokenCount,
      vectorId: "pending",
      embeddingModel: payload.embeddingModel,
      topic: payload.topic,
      subtopic: payload.subtopic,
      title: payload.title,
      summary: payload.summary,
      keywords: payload.keywords,
      concepts: payload.concepts,
      tags: payload.tags,
      sourceType: payload.sourceType,
      sectionPath: payload.sectionPath,
      contentPreview: payload.contentPreview,
      level: payload.level,
      parentChunkIndex: payload.parentChunkIndex,
      parentChunkId: payload.parentChunkId
        ? new mongoose.Types.ObjectId(payload.parentChunkId)
        : undefined,
      searchableText: payload.searchableText,
      metadata: payload.metadata,
    })) as IChunk;

    const vectorId = chunk._id.toString();
    chunk.vectorId = vectorId;
    await chunk.save();

    await upsertVectors([
      {
        id: vectorId,
        values: payload.vector,
        metadata: buildPineconeMetadata(payload),
      },
    ]);

    return vectorId;
  }

  async deleteVector(vectorId: string, userId: string): Promise<void> {
    // MongoDB enforces ownership before deleting from Pinecone
    const deleted = await ChunkModel.deleteOne({ _id: vectorId, userId });
    if (deleted.deletedCount > 0) {
      await deleteVectorById(vectorId);
    }
  }

  async deleteVectorsByDocument(
    documentId: string,
    userId: string
  ): Promise<void> {
    const chunks = await ChunkModel.find({ documentId, userId })
      .select("vectorId")
      .lean();

    const vectorIds = chunks
      .map((chunk) => chunk.vectorId)
      .filter((id): id is string => Boolean(id) && id !== "pending");

    await ChunkModel.deleteMany({ documentId, userId });

    if (vectorIds.length > 0) {
      await deleteVectorsByIds(vectorIds);
      return;
    }

    // No MongoDB chunks — best-effort cleanup of orphaned Pinecone vectors.
    await deleteVectorsByDocumentFilter(documentId, userId);
  }

  async updateVector(
    vectorId: string,
    payload: StoreVectorPayload
  ): Promise<void> {
    await ChunkModel.findOneAndUpdate(
      { _id: vectorId, userId: payload.metadata.userId },
      {
        text: payload.text,
        tokenCount: payload.tokenCount,
        embeddingModel: payload.embeddingModel,
        topic: payload.topic,
        subtopic: payload.subtopic,
        title: payload.title,
        summary: payload.summary,
        keywords: payload.keywords,
        concepts: payload.concepts,
        tags: payload.tags,
        sectionPath: payload.sectionPath,
        contentPreview: payload.contentPreview,
        searchableText: payload.searchableText,
        metadata: payload.metadata,
      }
    );

    await upsertVectors([
      {
        id: vectorId,
        values: payload.vector,
        metadata: buildPineconeMetadata(payload),
      },
    ]);
  }

  /**
   * Semantic search via Pinecone, hydrated with full chunk data from MongoDB.
   */
  async searchVector(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const limit = query.limit ?? 10;
    const minScore = query.minScore ?? 0;

    const filter = buildPineconeFilter({
      userId: query.userId,
      documentIds: query.documentIds,
      topic: query.topic,
      tags: query.tags,
    });

    const matches = await queryVectors({
      vector: query.vector,
      topK: limit,
      filter,
      minScore,
    });

    if (matches.length === 0) return [];

    const chunkIds = matches.map((m) => m.id);
    const chunks = await ChunkModel.find({
      _id: { $in: chunkIds },
      userId: query.userId,
    }).lean();

    const chunkById = new Map(chunks.map((c) => [c._id.toString(), c]));
    const scoreById = new Map(matches.map((m) => [m.id, m.score]));

    const results: VectorSearchResult[] = [];

    for (const match of matches) {
      const chunk = chunkById.get(match.id);
      if (!chunk) continue;

      results.push(
        mapChunkToSearchResult({
          ...(chunk as unknown as Record<string, unknown>),
          score: scoreById.get(match.id) ?? match.score,
        })
      );
    }

    return results;
  }

  /** MongoDB full-text search on enriched chunk fields (hybrid search keyword leg) */
  async searchKeyword(
    query: KeywordSearchQuery
  ): Promise<KeywordSearchResult[]> {
    const limit = query.limit ?? 20;
    const trimmed = query.query.trim();

    if (!trimmed) return [];

    const filter: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(query.userId),
      $text: { $search: trimmed },
    };

    if (query.documentIds && query.documentIds.length > 0) {
      filter.documentId = {
        $in: query.documentIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    try {
      const chunks = await ChunkModel.find(filter, {
        score: { $meta: "textScore" },
      })
        .sort({ score: { $meta: "textScore" } })
        .limit(limit)
        .lean();

      return chunks.map((chunk) => {
        const textScore =
          (chunk as unknown as { score?: number }).score ?? 0;

        return {
          ...mapChunkToSearchResult({
            ...(chunk as unknown as Record<string, unknown>),
            score: textScore,
          }),
          score: textScore,
        };
      });
    } catch (err) {
      console.warn(
        "[vectorStore] $text search unavailable, using regex fallback:",
        err instanceof Error ? err.message : err
      );

      return this.searchKeywordFallback(query, limit);
    }
  }

  private async searchKeywordFallback(
    query: KeywordSearchQuery,
    limit: number
  ): Promise<KeywordSearchResult[]> {
    const terms = query.query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    if (terms.length === 0) return [];

    const filter: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(query.userId),
      $or: terms.flatMap((term) => [
        { topic: { $regex: term, $options: "i" } },
        { subtopic: { $regex: term, $options: "i" } },
        { title: { $regex: term, $options: "i" } },
        { keywords: term },
        { tags: term },
        { searchableText: { $regex: term, $options: "i" } },
      ]),
    };

    if (query.documentIds && query.documentIds.length > 0) {
      filter.documentId = {
        $in: query.documentIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const chunks = await ChunkModel.find(filter).limit(limit * 3).lean();

    const scored = chunks
      .map((chunk) => {
        const haystack = [
          chunk.topic,
          chunk.subtopic,
          chunk.title,
          chunk.summary,
          chunk.searchableText,
          ...(chunk.keywords ?? []),
          ...(chunk.tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        let matches = 0;
        for (const term of terms) {
          if (haystack.includes(term)) matches += 1;
        }

        return { chunk, score: matches / terms.length };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ chunk, score }) => ({
      ...mapChunkToSearchResult({
        ...(chunk as unknown as Record<string, unknown>),
        score,
      }),
      score,
    }));
  }
}

export const vectorStore: IVectorStore = new PineconeVectorStore();

export { PineconeVectorStore };
