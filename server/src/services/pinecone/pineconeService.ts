import { Pinecone, type Index } from "@pinecone-database/pinecone";
import { env } from "../../config/env";
import type {
  PineconeChunkMetadata,
  PineconeQueryMatch,
  PineconeUpsertRecord,
} from "../../types/pinecone";

let pineconeClient: Pinecone | null = null;
let pineconeIndex: Index<PineconeChunkMetadata> | null = null;

/**
 * Centralized Pinecone client and index accessor.
 *
 * Vectors are stored in Pinecone; chunk text and keyword fields remain in MongoDB.
 * This split keeps Pinecone metadata small while preserving full-text keyword search.
 */
export function getPineconeClient(): Pinecone {
  if (!env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not configured");
  }

  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  }

  return pineconeClient;
}

export function getPineconeIndex(): Index<PineconeChunkMetadata> {
  if (!env.PINECONE_INDEX_NAME) {
    throw new Error("PINECONE_INDEX_NAME is not configured");
  }

  if (!pineconeIndex) {
    const client = getPineconeClient();
    pineconeIndex = client.index<PineconeChunkMetadata>({
      name: env.PINECONE_INDEX_NAME,
    });
  }

  return pineconeIndex;
}

function namespaceOptions(): { namespace?: string } {
  return env.PINECONE_NAMESPACE
    ? { namespace: env.PINECONE_NAMESPACE }
    : {};
}

function isPineconeNotFoundError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b404\b|not found/i.test(message);
}

/** Delete is idempotent — missing namespaces/vectors should not block reindex. */
function swallowPineconeNotFound(err: unknown): void {
  if (!isPineconeNotFoundError(err)) {
    throw err;
  }
}

/**
 * Upsert one or more vectors into Pinecone.
 * Batch upserts in groups of 100 (Pinecone recommended batch size).
 */
export async function upsertVectors(
  records: PineconeUpsertRecord[]
): Promise<void> {
  if (records.length === 0) return;

  const index = getPineconeIndex();
  const BATCH_SIZE = 100;

  try {
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      await index.upsert({
        records: batch.map((r) => ({
          id: r.id,
          values: r.values,
          metadata: r.metadata,
        })),
        ...namespaceOptions(),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Pinecone upsert failed: ${message}`);
  }
}

export interface PineconeSearchOptions {
  vector: number[];
  topK: number;
  filter?: Record<string, unknown>;
  minScore?: number;
}

/**
 * Query Pinecone for similar vectors with optional metadata filtering.
 */
export async function queryVectors(
  options: PineconeSearchOptions
): Promise<PineconeQueryMatch[]> {
  const index = getPineconeIndex();

  try {
    const response = await index.query({
      vector: options.vector,
      topK: options.topK,
      includeMetadata: true,
      filter: options.filter,
      ...namespaceOptions(),
    });

    const minScore = options.minScore ?? 0;

    return (response.matches ?? [])
      .filter((match) => (match.score ?? 0) >= minScore)
      .map((match) => ({
        id: match.id,
        score: match.score ?? 0,
        metadata: match.metadata as PineconeChunkMetadata | undefined,
      }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Pinecone query failed: ${message}`);
  }
}

/** Delete vectors by their Pinecone record IDs */
export async function deleteVectorsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const index = getPineconeIndex();
  const BATCH_SIZE = 1000;

  try {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      await index.deleteMany({
        ids: ids.slice(i, i + BATCH_SIZE),
        ...namespaceOptions(),
      });
    }
  } catch (err) {
    try {
      swallowPineconeNotFound(err);
    } catch (retryErr) {
      const message =
        retryErr instanceof Error ? retryErr.message : String(retryErr);
      throw new Error(`Pinecone delete by IDs failed: ${message}`);
    }
  }
}

/** Delete all vectors for a document using metadata filter (fallback cleanup). */
export async function deleteVectorsByDocumentFilter(
  documentId: string,
  userId: string
): Promise<void> {
  const index = getPineconeIndex();

  try {
    await index.deleteMany({
      filter: {
        documentId: { $eq: documentId },
        userId: { $eq: userId },
      },
      ...namespaceOptions(),
    });
  } catch (err) {
    try {
      swallowPineconeNotFound(err);
    } catch (retryErr) {
      const message =
        retryErr instanceof Error ? retryErr.message : String(retryErr);
      throw new Error(`Pinecone delete by document failed: ${message}`);
    }
  }
}

/** Delete a single vector by Pinecone record ID */
export async function deleteVectorById(vectorId: string): Promise<void> {
  const index = getPineconeIndex();

  try {
    await index.deleteMany({
      ids: [vectorId],
      ...namespaceOptions(),
    });
  } catch (err) {
    try {
      swallowPineconeNotFound(err);
    } catch (retryErr) {
      const message =
        retryErr instanceof Error ? retryErr.message : String(retryErr);
      throw new Error(`Pinecone delete vector failed: ${message}`);
    }
  }
}

/**
 * Validate Pinecone connectivity and index dimension at startup.
 * Call from server bootstrap or the setup script.
 */
export async function validatePineconeConnection(): Promise<{
  indexName: string;
  dimension: number;
  status: string;
}> {
  const client = getPineconeClient();
  const indexModel = await client.describeIndex(env.PINECONE_INDEX_NAME);

  if (indexModel.dimension !== env.PINECONE_EMBEDDING_DIMENSION) {
    throw new Error(
      `Pinecone index dimension (${indexModel.dimension}) does not match ` +
        `PINECONE_EMBEDDING_DIMENSION (${env.PINECONE_EMBEDDING_DIMENSION}). ` +
        `Ensure your index was created with dimension ${env.PINECONE_EMBEDDING_DIMENSION} for ${env.MISTRAL_EMBEDDING_MODEL}.`
    );
  }

  return {
    indexName: indexModel.name,
    dimension: indexModel.dimension ?? env.PINECONE_EMBEDDING_DIMENSION,
    status: indexModel.status?.state ?? "unknown",
  };
}

/** Build Pinecone metadata filter from search constraints */
export function buildPineconeFilter(options: {
  userId: string;
  documentIds?: string[];
  topic?: string;
  tags?: string[];
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    userId: { $eq: options.userId },
  };

  if (options.documentIds && options.documentIds.length > 0) {
    filter.documentId =
      options.documentIds.length === 1
        ? { $eq: options.documentIds[0] }
        : { $in: options.documentIds };
  }

  if (options.topic) {
    filter.topic = { $eq: options.topic };
  }

  if (options.tags && options.tags.length > 0) {
    filter.tags = { $in: options.tags.map((t) => t.toLowerCase()) };
  }

  return filter;
}
