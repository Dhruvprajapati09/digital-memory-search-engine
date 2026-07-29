import { env } from "../../config/env";
import ChunkModel from "../../models/Chunk";
import type {
  IncrementalIndexPlan,
  SemanticChunk,
} from "../../types/documentIntelligence";
import { computeChunkHash } from "./metadataEnrichmentService";
import { needsReEmbedding } from "./embeddingVersionService";

interface ExistingChunkRecord {
  chunkIndex: number;
  vectorId: string;
  chunkHash?: string;
  embeddingVersion?: string;
  embeddingModel?: string;
  text?: string;
}

/**
 * Plan incremental indexing by comparing chunk hashes with existing index.
 */
export async function planIncrementalIndex(
  documentId: string,
  userId: string,
  newChunks: SemanticChunk[],
  embeddingModel: string
): Promise<IncrementalIndexPlan> {
  if (!env.ENABLE_INCREMENTAL_INDEXING) {
    return {
      unchanged: [],
      changed: newChunks,
      removed: [],
      isFullReindex: true,
    };
  }

  const existing = (await ChunkModel.find({ documentId, userId })
    .select("chunkIndex vectorId chunkHash embeddingVersion embeddingModel text")
    .lean()) as ExistingChunkRecord[];

  if (existing.length === 0) {
    return {
      unchanged: [],
      changed: newChunks,
      removed: [],
      isFullReindex: true,
    };
  }

  const existingByIndex = new Map(
    existing.map((c) => [c.chunkIndex, c])
  );
  const newByIndex = new Map(newChunks.map((c) => [c.chunkIndex, c]));

  const unchanged: IncrementalIndexPlan["unchanged"] = [];
  const changed: IncrementalIndexPlan["changed"] = [];

  for (const chunk of newChunks) {
    const hash =
      chunk.chunkHash ??
      computeChunkHash(
        chunk.text,
        `${chunk.title}|${chunk.sectionPath.join("/")}|${env.EMBEDDING_VERSION}`
      );

    const stored = existingByIndex.get(chunk.chunkIndex);

    if (
      stored &&
      !needsReEmbedding(stored, {
        chunkHash: hash,
        embeddingVersion: env.EMBEDDING_VERSION,
        embeddingModel,
      })
    ) {
      unchanged.push({
        chunkIndex: chunk.chunkIndex,
        vectorId: stored.vectorId,
        chunkHash: hash,
      });
    } else {
      changed.push({
        ...chunk,
        chunkHash: hash,
        existingVectorId: stored?.vectorId,
      });
    }
  }

  const removed: IncrementalIndexPlan["removed"] = [];

  for (const record of existing) {
    if (!newByIndex.has(record.chunkIndex)) {
      removed.push({
        chunkIndex: record.chunkIndex,
        vectorId: record.vectorId,
      });
    }
  }

  return {
    unchanged,
    changed,
    removed,
    isFullReindex: unchanged.length === 0 && existing.length > 0,
  };
}

/** Determine which chunks need embedding generation */
export function getChunksNeedingEmbeddings(
  plan: IncrementalIndexPlan
): Array<SemanticChunk & { existingVectorId?: string }> {
  return plan.changed;
}
