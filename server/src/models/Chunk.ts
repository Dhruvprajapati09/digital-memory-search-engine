import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IChunk extends MongooseDocument {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  vectorId: string;
  embedding: number[];
  embeddingModel: string;
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
    embedding: {
      type: [Number],
      required: true,
    },
    embeddingModel: {
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
        const { embedding, __v, ...safeChunk } = ret as Record<
          string,
          unknown
        > & { embedding?: number[]; __v?: number };
        return safeChunk;
      },
    },
  }
);

chunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
chunkSchema.index({ userId: 1, documentId: 1 });

const ChunkModel = mongoose.model<IChunk>("Chunk", chunkSchema);

export default ChunkModel;
