import ChunkModel, { IChunk } from "../models/Chunk";
import type {
  IVectorStore,
  StoreVectorPayload,
  VectorSearchQuery,
  VectorSearchResult,
} from "../types/embedding";

/** Cosine similarity between two vectors (used when Atlas Vector Search is unavailable) */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

/**
 * MongoDB-backed vector store.
 * Stores embeddings in the chunks collection.
 * Uses in-memory cosine similarity for search (Milestone 7 can switch to Atlas $vectorSearch).
 */
class MongoVectorStore implements IVectorStore {
  async storeVector(payload: StoreVectorPayload): Promise<string> {
    const chunk = (await ChunkModel.create({
      documentId: payload.metadata.documentId,
      userId: payload.metadata.userId,
      chunkIndex: payload.metadata.chunkIndex,
      text: payload.text,
      tokenCount: payload.tokenCount,
      vectorId: "pending",
      embedding: payload.vector,
      embeddingModel: payload.embeddingModel,
      metadata: payload.metadata,
    })) as IChunk;

    const vectorId = chunk._id.toString();
    chunk.vectorId = vectorId;
    await chunk.save();

    console.log(`[vectorStore] Vector saved: ${vectorId}`);
    return vectorId;
  }

  async deleteVector(vectorId: string, userId: string): Promise<void> {
    await ChunkModel.deleteOne({ _id: vectorId, userId });
  }

  async deleteVectorsByDocument(
    documentId: string,
    userId: string
  ): Promise<void> {
    const result = await ChunkModel.deleteMany({ documentId, userId });
    console.log(
      `[vectorStore] Deleted ${result.deletedCount} vectors for document ${documentId}`
    );
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
        embedding: payload.vector,
        embeddingModel: payload.embeddingModel,
        metadata: payload.metadata,
      }
    );
  }

  /**
   * Semantic search over stored chunks.
   * Milestone 7 will replace this with MongoDB Atlas $vectorSearch or Pinecone.
   */
  async searchVector(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const limit = query.limit ?? 10;
    const minScore = query.minScore ?? 0;

    const filter: Record<string, unknown> = { userId: query.userId };

    if (query.documentIds && query.documentIds.length > 0) {
      filter.documentId = { $in: query.documentIds };
    }

    const chunks = await ChunkModel.find(filter).lean();

    const scored = chunks
      .map((chunk) => ({
        vectorId: chunk.vectorId,
        score: cosineSimilarity(query.vector, chunk.embedding),
        text: chunk.text,
        metadata: chunk.metadata as unknown as VectorSearchResult["metadata"],
      }))
      .filter((item) => item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }
}

/** Pinecone placeholder — implement when switching providers */
class PineconeVectorStore implements IVectorStore {
  async storeVector(_payload: StoreVectorPayload): Promise<string> {
    throw new Error("Pinecone vector store is not configured yet");
  }

  async deleteVector(_vectorId: string, _userId: string): Promise<void> {
    throw new Error("Pinecone vector store is not configured yet");
  }

  async deleteVectorsByDocument(
    _documentId: string,
    _userId: string
  ): Promise<void> {
    throw new Error("Pinecone vector store is not configured yet");
  }

  async updateVector(
    _vectorId: string,
    _payload: StoreVectorPayload
  ): Promise<void> {
    throw new Error("Pinecone vector store is not configured yet");
  }

  async searchVector(_query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    throw new Error("Pinecone vector store is not configured yet");
  }
}

function createVectorStore(): IVectorStore {
  const provider = process.env.VECTOR_STORE_PROVIDER ?? "mongodb";

  if (provider === "pinecone") {
    return new PineconeVectorStore();
  }

  return new MongoVectorStore();
}

export const vectorStore = createVectorStore();

export { MongoVectorStore, PineconeVectorStore, cosineSimilarity };
