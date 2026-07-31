import mongoose, { Document, Schema, Types } from "mongoose";

export interface IConversationSource {
  documentId: string;
  documentName: string;
  preview: string;
  page?: number;
}

export interface IConversationMessage {
  _id?: Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  sources: IConversationSource[];
  noResults: boolean;
  createdAt: Date;
}

export interface IConversation extends Document {
  userId: Types.ObjectId;
  title: string;
  messages: IConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const conversationSourceSchema = new Schema<IConversationSource>(
  {
    documentId: { type: String, required: true },
    documentName: { type: String, required: true, default: "Untitled" },
    preview: { type: String, required: true, default: "" },
    page: { type: Number, required: false },
  },
  { _id: false }
);

const conversationMessageSchema = new Schema<IConversationMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    sources: {
      type: [conversationSourceSchema],
      default: [],
    },
    noResults: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const conversationSchema = new Schema<IConversation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      default: "New chat",
    },
    messages: {
      type: [conversationMessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "conversations",
  }
);

conversationSchema.index({ userId: 1, updatedAt: -1 });

const ConversationModel = mongoose.model<IConversation>(
  "Conversation",
  conversationSchema
);

export default ConversationModel;
