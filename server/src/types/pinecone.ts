import type { RecordMetadata } from "@pinecone-database/pinecone";

/**
 * Pinecone metadata stored alongside each chunk vector.
 *
 * Keep metadata compact — Pinecone limits per-record metadata size.
 * Full chunk text lives in MongoDB; only filter/ranking fields go here.
 *
 * Values must be string | number | boolean | string[] (Pinecone RecordMetadataValue).
 */
export interface PineconeChunkMetadata extends RecordMetadata {
  userId: string;
  documentId: string;
  chunkIndex: number;
  topic: string;
  subtopic: string;
  title: string;
  sourceType: string;
  tags: string[];
  /** Phase 5 filter metadata — always set with defaults for Pinecone compatibility */
  pageNumber: number;
  chapter: string;
  section: string;
  language: string;
  embeddingVersion: string;
}

export interface PineconeUpsertRecord {
  id: string;
  values: number[];
  metadata: PineconeChunkMetadata;
}

export interface PineconeQueryMatch {
  id: string;
  score: number;
  metadata?: PineconeChunkMetadata;
}
