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
  topic?: string;
  subtopic?: string;
  title?: string;
  summary?: string;
  keywords?: string[];
  concepts?: string[];
  tags?: string[];
  sectionPath?: string[];
  contentPreview?: string;
  level?: string;
  parentChunkIndex?: number;
  parentChunkId?: string;
  [key: string]: unknown;
}

export interface StoreVectorPayload {
  vector: number[];
  text: string;
  searchableText: string;
  metadata: VectorMetadata;
  embeddingModel: string;
  tokenCount: number;
  /** Rich fields stored on chunk document */
  topic: string;
  subtopic?: string;
  title: string;
  summary: string;
  keywords: string[];
  concepts: string[];
  tags: string[];
<<<<<<< HEAD
  sourceType: "pdf" | "image" | "note";
=======
  sourceType: "pdf" | "image" | "note" | "video";
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
  sectionPath: string[];
  contentPreview: string;
  level: "document" | "topic" | "subtopic" | "semantic";
  parentChunkIndex?: number;
  parentChunkId?: string;
}

export interface VectorSearchQuery {
  vector: number[];
  userId: string;
  limit?: number;
  minScore?: number;
  /** Restrict search to chunks belonging to these documents */
  documentIds?: string[];
  /** Filter by topic/tag metadata */
  topic?: string;
  tags?: string[];
}

export interface VectorSearchResult {
  vectorId: string;
  score: number;
  text: string;
  metadata: VectorMetadata;
  topic?: string;
  subtopic?: string;
  title?: string;
  summary?: string;
  keywords?: string[];
  tags?: string[];
  sectionPath?: string[];
  contentPreview?: string;
}

export interface KeywordSearchQuery {
  query: string;
  userId: string;
  limit?: number;
  documentIds?: string[];
}

export interface KeywordSearchResult {
  vectorId: string;
  score: number;
  text: string;
  metadata: VectorMetadata;
  topic?: string;
  subtopic?: string;
  title?: string;
  summary?: string;
  keywords?: string[];
  tags?: string[];
  sectionPath?: string[];
  contentPreview?: string;
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
  topic?: string;
  subtopic?: string;
  title?: string;
  summary?: string;
  keywords?: string[];
  tags?: string[];
  sectionPath?: string[];
  contentPreview?: string;
  level?: string;
  parentChunkId?: string;
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
  searchKeyword(query: KeywordSearchQuery): Promise<KeywordSearchResult[]>;
}
