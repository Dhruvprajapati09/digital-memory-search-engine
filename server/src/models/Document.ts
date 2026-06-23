import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export type DocumentType = "pdf" | "image" | "note";

export interface IDocument extends MongooseDocument {
  userId: mongoose.Types.ObjectId;
  title: string;
  type: DocumentType;
  originalFileName?: string;
  storedFileName?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  noteContent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    type: {
      type: String,
      required: [true, "Document type is required"],
      enum: {
        values: ["pdf", "image", "note"],
        message: "Type must be pdf, image, or note",
      },
    },
    originalFileName: {
      type: String,
      trim: true,
    },
    storedFileName: {
      type: String,
      trim: true,
    },
    filePath: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
      min: [0, "File size cannot be negative"],
    },
    mimeType: {
      type: String,
      trim: true,
    },
    noteContent: {
      type: String,
      trim: true,
      maxlength: [10000, "Note content cannot exceed 10000 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const { __v, ...safeDoc } = ret as Record<string, unknown> & {
          __v?: number;
        };
        return safeDoc;
      },
    },
  }
);

const DocumentModel = mongoose.model<IDocument>("Document", documentSchema);

export default DocumentModel;
