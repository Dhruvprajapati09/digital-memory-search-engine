import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISearchHistory extends Document {
  userId: Types.ObjectId;
  query: string;
  resultCount: number;
  searchTimeMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const searchHistorySchema = new Schema<ISearchHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    resultCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    searchTimeMs: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: "search_history",
  }
);

searchHistorySchema.index({ userId: 1, createdAt: -1 });
searchHistorySchema.index({ userId: 1, query: 1 });

const SearchHistoryModel = mongoose.model<ISearchHistory>(
  "SearchHistory",
  searchHistorySchema
);

export default SearchHistoryModel;
