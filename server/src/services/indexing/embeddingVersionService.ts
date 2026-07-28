import { env } from "../../config/env";
import type { EmbeddingVersionInfo } from "../../types/documentIntelligence";

/** Current embedding version configuration */
export function getCurrentEmbeddingVersion(embeddingModel: string): Omit<EmbeddingVersionInfo, "chunkHash" | "embeddingDate"> & { embeddingDate: Date } {
  return {
    embeddingModel,
    embeddingVersion: env.EMBEDDING_VERSION,
    embeddingDate: new Date(),
  };
}

/** Check if a chunk needs re-embedding based on version/hash */
export function needsReEmbedding(
  stored: {
    chunkHash?: string;
    embeddingVersion?: string;
    embeddingModel?: string;
  },
  current: {
    chunkHash: string;
    embeddingVersion: string;
    embeddingModel: string;
  }
): boolean {
  if (!stored.chunkHash || !stored.embeddingVersion) return true;
  if (stored.chunkHash !== current.chunkHash) return true;
  if (stored.embeddingVersion !== current.embeddingVersion) return true;
  if (stored.embeddingModel !== current.embeddingModel) return true;
  return false;
}

/** Build version metadata for storage */
export function buildEmbeddingVersionMetadata(
  chunkHash: string,
  embeddingModel: string
): EmbeddingVersionInfo {
  return {
    chunkHash,
    embeddingModel,
    embeddingVersion: env.EMBEDDING_VERSION,
    embeddingDate: new Date(),
  };
}
