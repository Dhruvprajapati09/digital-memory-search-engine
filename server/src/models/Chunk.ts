import mongoose, { Schema, Document as MongooseDocument } from "mongoose";
import type { ChunkLevel } from "../types/chunking";

export interface IChunk extends MongooseDocument {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  vectorId: string;
  /** Embeddings are stored in Pinecone, not MongoDB */
  embeddingModel: string;
  /** Rich topic metadata */
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
  level: ChunkLevel;
  parentChunkId?: mongoose.Types.ObjectId;
  parentChunkIndex?: number;
  /** Combined text for MongoDB $text search */
  searchableText: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const chunkSchema = new Schema<IChunk>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    text: {
      type: String,
      required: true,
    },
    tokenCount: {
      type: Number,
      required: true,
      min: 0,
    },
    vectorId: {
      type: String,
      required: true,
      index: true,
    },
    embeddingModel: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      required: true,
      index: true,
    },
    subtopic: {
      type: String,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    summary: {
      type: String,
      default: "",
    },
    keywords: {
      type: [String],
      default: [],
    },
    concepts: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    sourceType: {
      type: String,
<<<<<<< HEAD
      enum: ["pdf", "image", "note"],
=======
      enum: ["pdf", "image", "note", "video"],
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
      required: true,
    },
    sectionPath: {
      type: [String],
      default: [],
    },
    contentPreview: {
      type: String,
      default: "",
    },
    level: {
      type: String,
      enum: ["document", "topic", "subtopic", "semantic"],
      default: "semantic",
    },
    parentChunkId: {
      type: Schema.Types.ObjectId,
      ref: "Chunk",
    },
    parentChunkIndex: {
      type: Number,
    },
    searchableText: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const { searchableText, __v, ...safeChunk } = ret as Record<
          string,
          unknown
        > & { searchableText?: string; __v?: number };
        return safeChunk;
      },
    },
  }
);

chunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
chunkSchema.index({ userId: 1, documentId: 1 });
chunkSchema.index({ userId: 1, topic: 1 });
chunkSchema.index({ userId: 1, tags: 1 });
chunkSchema.index({ userId: 1, keywords: 1 });
chunkSchema.index(
  {
    title: "text",
    topic: "text",
    subtopic: "text",
    summary: "text",
    searchableText: "text",
    keywords: "text",
    tags: "text",
  },
  {
    weights: {
      title: 10,
      topic: 8,
      subtopic: 6,
      keywords: 5,
      tags: 4,
      summary: 3,
      searchableText: 1,
    },
    name: "chunk_text_search",
  }
);

const ChunkModel = mongoose.model<IChunk>("Chunk", chunkSchema);

export default ChunkModel;
