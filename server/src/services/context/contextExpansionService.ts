import mongoose from "mongoose";
import ChunkModel, { IChunk } from "../../models/Chunk";
import { env } from "../../config/env";
import type { RetrievedChunk } from "../../types/chat";
import type { VectorMetadata } from "../../types/embedding";

function chunkDocToRetrieved(
  doc: IChunk | Record<string, unknown>,
  score: number,
  userId: string
): RetrievedChunk {
  const chunk = doc as IChunk;
  const meta = (chunk.metadata as Record<string, unknown> | undefined) ?? {};

  const metadata: VectorMetadata = {
    documentId: String(chunk.documentId),
    userId,
    chunkIndex: chunk.chunkIndex,
    type: chunk.sourceType,
    documentTitle: meta.documentTitle as string | undefined,
    topic: chunk.topic,
    subtopic: chunk.subtopic,
    title: chunk.title,
    summary: chunk.summary,
    keywords: chunk.keywords,
    concepts: chunk.concepts,
    tags: chunk.tags,
    sectionPath: chunk.sectionPath,
    contentPreview: chunk.contentPreview,
    level: chunk.level,
    parentChunkIndex: chunk.parentChunkIndex,
    parentChunkId: chunk.parentChunkId
      ? String(chunk.parentChunkId)
      : undefined,
    chapter: chunk.chapter,
    section: chunk.section,
    pageNumber: chunk.pageNumber,
    sourceType: chunk.sourceType,
    ...meta,
  };

  return {
    vectorId: chunk.vectorId ?? String(chunk._id),
    score,
    text: chunk.text,
    metadata,
    topic: chunk.topic,
    subtopic: chunk.subtopic,
    title: chunk.title,
    summary: chunk.summary,
    keywords: chunk.keywords,
    tags: chunk.tags,
    sectionPath: chunk.sectionPath,
    contentPreview: chunk.contentPreview,
  };
}

/**
 * Expand seed chunks with neighbors and parent/child sections.
 */
export async function expandChunkContext(
  userId: string,
  seedChunks: RetrievedChunk[]
): Promise<RetrievedChunk[]> {
  if (!env.ENABLE_CONTEXT_EXPANSION || seedChunks.length === 0) {
    return seedChunks;
  }

  const neighborCount = env.CONTEXT_NEIGHBOR_COUNT;
  const byKey = new Map<string, RetrievedChunk>();
  const scoreByKey = new Map<string, number>();

  const register = (chunk: RetrievedChunk, score: number) => {
    const key = `${chunk.metadata.documentId}:${chunk.metadata.chunkIndex}`;
    const existing = byKey.get(key);
    if (!existing || score > (scoreByKey.get(key) ?? 0)) {
      byKey.set(key, chunk);
      scoreByKey.set(key, score);
    }
  };

  for (const seed of seedChunks) {
    register(seed, seed.score);

    const docId = seed.metadata.documentId;
    const idx = seed.metadata.chunkIndex;
    const indices = new Set<number>();

    for (let offset = -neighborCount; offset <= neighborCount; offset += 1) {
      if (offset === 0) continue;
      const neighborIdx = idx + offset;
      if (neighborIdx >= 0) indices.add(neighborIdx);
    }

    const parentChunkId = seed.metadata.parentChunkId as string | undefined;
    const parentChunkIndex = seed.metadata.parentChunkIndex as
      | number
      | undefined;

    const orConditions: Record<string, unknown>[] = [];

    if (indices.size > 0) {
      orConditions.push({
        documentId: new mongoose.Types.ObjectId(docId),
        chunkIndex: { $in: [...indices] },
      });
    }

    if (parentChunkId && mongoose.Types.ObjectId.isValid(parentChunkId)) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(parentChunkId) });
    }

    if (parentChunkIndex !== undefined) {
      orConditions.push({
        documentId: new mongoose.Types.ObjectId(docId),
        chunkIndex: parentChunkIndex,
      });
    }

    // Child subsections sharing this chunk as parent
    if (seed.vectorId && mongoose.Types.ObjectId.isValid(seed.vectorId)) {
      orConditions.push({
        parentChunkId: new mongoose.Types.ObjectId(seed.vectorId),
      });
    }

    if (orConditions.length === 0) continue;

    const related = await ChunkModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      $or: orConditions,
    }).lean();

    const neighborScore = seed.score * 0.85;

    for (const doc of related) {
      register(
        chunkDocToRetrieved(doc, neighborScore, userId),
        neighborScore
      );
    }
  }

  return [...byKey.values()];
}
