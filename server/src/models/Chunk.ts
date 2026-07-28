import mongoose, { Schema, Document as MongooseDocument } from "mongoose";
import type { ChunkLevel } from "../types/chunking";
import type {
  ExtractedEntity,
  ExtractedRelationship,
  PageRange,
} from "../types/documentIntelligence";

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
  sourceType: "pdf" | "image" | "note" | "video";
  sectionPath: string[];
  contentPreview: string;
  level: ChunkLevel;
  parentChunkId?: mongoose.Types.ObjectId;
  parentChunkIndex?: number;
  /** Phase 5 structural metadata */
  chapter?: string;
  section?: string;
  heading?: string;
  parentHeading?: string;
  pageNumber?: number;
  pageRange?: PageRange;
  pageOffset?: number;
  sourcePage?: number;
  entities?: ExtractedEntity[];
  relationships?: ExtractedRelationship[];
  language?: string;
  embeddingVersion?: string;
  embeddingDate?: Date;
  chunkHash?: string;
  indexVersion?: number;
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
      enum: ["pdf", "image", "note", "video"],
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
    chapter: {
      type: String,
      trim: true,
      index: true,
    },
    section: {
      type: String,
      trim: true,
      index: true,
    },
    heading: {
      type: String,
      trim: true,
    },
    parentHeading: {
      type: String,
      trim: true,
    },
    pageNumber: {
      type: Number,
      min: 0,
      index: true,
    },
    pageRange: {
      start: { type: Number, min: 0 },
      end: { type: Number, min: 0 },
    },
    pageOffset: {
      type: Number,
      min: 0,
    },
    sourcePage: {
      type: Number,
      min: 0,
    },
    entities: {
      type: [
        {
          name: { type: String, required: true },
          type: { type: String, required: true },
        },
      ],
      default: [],
    },
    relationships: {
      type: [
        {
          source: { type: String, required: true },
          target: { type: String, required: true },
          type: { type: String, required: true },
        },
      ],
      default: [],
    },
    language: {
      type: String,
      trim: true,
      default: "en",
      index: true,
    },
    embeddingVersion: {
      type: String,
      trim: true,
      index: true,
    },
    embeddingDate: {
      type: Date,
    },
    chunkHash: {
      type: String,
      trim: true,
      index: true,
    },
    indexVersion: {
      type: Number,
      default: 1,
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
chunkSchema.index({ documentId: 1, chunkHash: 1 });
chunkSchema.index({ userId: 1, chapter: 1 });
chunkSchema.index({ userId: 1, section: 1 });
chunkSchema.index({ userId: 1, language: 1 });
chunkSchema.index({ userId: 1, "entities.name": 1 });
chunkSchema.index(
  {
    title: "text",
    topic: "text",
    subtopic: "text",
    summary: "text",
    searchableText: "text",
    keywords: "text",
    tags: "text",
    heading: "text",
    chapter: "text",
    section: "text",
  },
  {
    weights: {
      title: 10,
      heading: 9,
      chapter: 8,
      topic: 8,
      subtopic: 6,
      section: 6,
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
