import mongoose, { Schema, Document as MongooseDocument } from "mongoose";
import type { DocumentType } from "./Document";

/** Page-level text index for Module 1 pure document search (no embeddings). */
export interface IPageIndex extends MongooseDocument {
  userId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  pageNumber: number;
  text: string;
  documentName: string;
  title: string;
  type: DocumentType;
  storedFileName?: string;
  documentCreatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pageIndexSchema = new Schema<IPageIndex>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    pageNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    text: {
      type: String,
      required: true,
    },
    documentName: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["pdf", "image", "note", "video"],
      required: true,
      index: true,
    },
    storedFileName: {
      type: String,
      trim: true,
    },
    documentCreatedAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

pageIndexSchema.index(
  { userId: 1, documentId: 1, pageNumber: 1 },
  { unique: true }
);
pageIndexSchema.index({ userId: 1, type: 1 });
pageIndexSchema.index({ userId: 1, documentCreatedAt: -1 });

const PageIndexModel = mongoose.model<IPageIndex>("PageIndex", pageIndexSchema);

export default PageIndexModel;
