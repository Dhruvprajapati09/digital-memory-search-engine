import type { VectorMetadata } from "../types/embedding";

export interface ChatRequest {
  /** User question to answer using indexed documents */
  question: string;
  /** Limit retrieval to specific documents (optional) */
  documentIds?: string[];
  /** Override number of chunks retrieved for context */
  topK?: number;
}

export interface ChatSource {
  documentId: string;
  chunkIndex: number;
  topic?: string;
  title?: string;
  score: number;
  preview: string;
}

export interface ChatResponse {
  success: boolean;
  question: string;
  answer: string;
  model: string;
  sources: ChatSource[];
  /** True when no relevant chunks were found in Pinecone */
  noResults: boolean;
}

export interface RetrievedChunk {
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

export interface RetrievalOptions {
  userId: string;
  query: string;
  limit?: number;
  minScore?: number;
  documentIds?: string[];
  topic?: string;
  tags?: string[];
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  queryEmbeddingModel: string;
}
