import mongoose, { Schema, Document as MongooseDocument } from "mongoose";
import type { VideoStatus } from "../types/youtube";

import type { TranscriptSegment } from "../types/youtube";

export interface IVideo extends MongooseDocument {
  userId: mongoose.Types.ObjectId;
  videoId: string;
  url: string;
  title: string;
  description: string;
  channel: string;
  thumbnail: string;
  duration: string;
  durationSeconds: number;
  language?: string;
  publishedAt?: Date;
  transcript: string;
  transcriptSegments: TranscriptSegment[];
  documentId?: mongoose.Types.ObjectId;
  status: VideoStatus;
  statusError?: string | null;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const videoSchema = new Schema<IVideo>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    videoId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    channel: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnail: {
      type: String,
      default: "",
      trim: true,
    },
    duration: {
      type: String,
      default: "",
      trim: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    language: {
      type: String,
      trim: true,
    },
    publishedAt: {
      type: Date,
    },
    transcript: {
      type: String,
      default: "",
    },
    transcriptSegments: {
      type: [
        {
          text: String,
          startSeconds: Number,
          endSeconds: Number,
          durationSeconds: Number,
        },
      ],
      default: [],
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "indexed", "failed", "no_transcript"],
      default: "pending",
    },
    statusError: {
      type: String,
      default: null,
    },
    chunkCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const { __v, ...safe } = ret as Record<string, unknown> & {
          __v?: number;
        };
        return safe;
      },
    },
  }
);

videoSchema.index({ userId: 1, videoId: 1 }, { unique: true });

const VideoModel = mongoose.model<IVideo>("Video", videoSchema);

export default VideoModel;
