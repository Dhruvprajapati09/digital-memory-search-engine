import mongoose, { Schema, Document as MongooseDocument } from "mongoose";
import type {
  KnowledgeGraphEdgeData,
  KnowledgeGraphNodeData,
  KnowledgeGraphNodeType,
} from "../types/documentIntelligence";

export interface IKnowledgeGraphNode extends MongooseDocument, KnowledgeGraphNodeData {
  type: KnowledgeGraphNodeType;
}

export interface IKnowledgeGraphEdge extends MongooseDocument, KnowledgeGraphEdgeData {}

const knowledgeGraphNodeSchema = new Schema<IKnowledgeGraphNode>(
  {
    nodeId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["document", "section", "entity", "topic"],
      required: true,
      index: true,
    },
    label: { type: String, required: true, trim: true },
    documentId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

knowledgeGraphNodeSchema.index(
  { userId: 1, documentId: 1, nodeId: 1 },
  { unique: true }
);
knowledgeGraphNodeSchema.index({ userId: 1, type: 1, label: 1 });

const knowledgeGraphEdgeSchema = new Schema<IKnowledgeGraphEdge>(
  {
    edgeId: { type: String, required: true, index: true },
    sourceId: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    documentId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

knowledgeGraphEdgeSchema.index(
  { userId: 1, documentId: 1, edgeId: 1 },
  { unique: true }
);
knowledgeGraphEdgeSchema.index({ userId: 1, sourceId: 1 });
knowledgeGraphEdgeSchema.index({ userId: 1, targetId: 1 });

export const KnowledgeGraphNodeModel = mongoose.model<IKnowledgeGraphNode>(
  "KnowledgeGraphNode",
  knowledgeGraphNodeSchema
);

export const KnowledgeGraphEdgeModel = mongoose.model<IKnowledgeGraphEdge>(
  "KnowledgeGraphEdge",
  knowledgeGraphEdgeSchema
);
