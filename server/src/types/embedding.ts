export type IndexStatus = "pending" | "processing" | "indexed" | "failed";

export interface TextChunkInput {
  chunkIndex: number;
  text: string;
}

export interface EmbeddingResponse {
  vector: number[];
  model: string;
}

export interface VectorMetadata {
  documentId: string;
  userId: string;
  chunkIndex: number;
  type: string;
  documentTitle?: string;
  [key: string]: unknown;
}

export interface StoreVectorPayload {
  vector: number[];
  text: string;
  metadata: VectorMetadata;
  embeddingModel: string;
  tokenCount: number;
}

export interface VectorSearchQuery {
  vector: number[];
  userId: string;
  limit?: number;
  minScore?: number;
  /** Restrict search to chunks belonging to these documents */
  documentIds?: string[];
}

export interface VectorSearchResult {
  vectorId: string;
  score: number;
  text: string;
  metadata: VectorMetadata;
}

export interface IndexStatusResponse {
  status: IndexStatus;
  chunkCount: number;
  indexedAt?: string | null;
  embeddingModel?: string | null;
  indexError?: string | null;
}

export interface ChunkRecord {
  id: string;
  documentId: string;
  userId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  vectorId: string;
  embeddingModel: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Provider-agnostic vector store contract — swap MongoDB Atlas / Pinecone implementations */
export interface IVectorStore {
  storeVector(payload: StoreVectorPayload): Promise<string>;
  deleteVector(vectorId: string, userId: string): Promise<void>;
  deleteVectorsByDocument(documentId: string, userId: string): Promise<void>;
  updateVector(vectorId: string, payload: StoreVectorPayload): Promise<void>;
  searchVector(query: VectorSearchQuery): Promise<VectorSearchResult[]>;
}
