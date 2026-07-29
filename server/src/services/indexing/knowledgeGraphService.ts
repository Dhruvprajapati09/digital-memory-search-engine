import { env } from "../../config/env";
import type {
  ExtractedEntity,
  ExtractedRelationship,
  KnowledgeGraphEdgeData,
  KnowledgeGraphNodeData,
  SemanticChunk,
} from "../../types/documentIntelligence";
import {
  KnowledgeGraphEdgeModel,
  KnowledgeGraphNodeModel,
} from "../../models/KnowledgeGraph";
import { resetGraphRetrievalCache } from "../retrieval/graphRetrievalService";

function nodeId(type: string, label: string, documentId: string): string {
  return `${type}:${documentId}:${label.toLowerCase().replace(/\s+/g, "_")}`;
}

function edgeId(
  sourceId: string,
  type: string,
  targetId: string
): string {
  return `${sourceId}|${type}|${targetId}`;
}

/**
 * Build knowledge graph nodes and edges from document intelligence output.
 */
export function buildKnowledgeGraphData(
  documentId: string,
  userId: string,
  documentTitle: string,
  chunks: SemanticChunk[],
  entities: ExtractedEntity[],
  relationships: ExtractedRelationship[]
): { nodes: KnowledgeGraphNodeData[]; edges: KnowledgeGraphEdgeData[] } {
  if (!env.ENABLE_KNOWLEDGE_GRAPH) {
    return { nodes: [], edges: [] };
  }

  const nodes = new Map<string, KnowledgeGraphNodeData>();
  const edges = new Map<string, KnowledgeGraphEdgeData>();

  const docNodeId = nodeId("document", documentTitle, documentId);
  nodes.set(docNodeId, {
    nodeId: docNodeId,
    type: "document",
    label: documentTitle,
    documentId,
    userId,
  });

  const topicsSeen = new Set<string>();

  for (const chunk of chunks) {
    const topicLabel = chunk.topic;
    const topicNodeId = nodeId("topic", topicLabel, documentId);

    if (!topicsSeen.has(topicNodeId)) {
      topicsSeen.add(topicNodeId);
      nodes.set(topicNodeId, {
        nodeId: topicNodeId,
        type: "topic",
        label: topicLabel,
        documentId,
        userId,
        metadata: { chapter: chunk.chapter, section: chunk.section },
      });

      const docTopicEdgeId = edgeId(docNodeId, "CONTAINS", topicNodeId);
      edges.set(docTopicEdgeId, {
        edgeId: docTopicEdgeId,
        sourceId: docNodeId,
        targetId: topicNodeId,
        type: "CONTAINS",
        documentId,
        userId,
      });
    }

    if (chunk.section && chunk.section !== chunk.topic) {
      const sectionNodeId = nodeId("section", chunk.section, documentId);
      nodes.set(sectionNodeId, {
        nodeId: sectionNodeId,
        type: "section",
        label: chunk.section,
        documentId,
        userId,
        metadata: {
          chapter: chunk.chapter,
          heading: chunk.heading,
          pageNumber: chunk.pageNumber,
        },
      });

      const sectionEdgeId = edgeId(topicNodeId, "HAS_SECTION", sectionNodeId);
      edges.set(sectionEdgeId, {
        edgeId: sectionEdgeId,
        sourceId: topicNodeId,
        targetId: sectionNodeId,
        type: "HAS_SECTION",
        documentId,
        userId,
      });
    }
  }

  for (const entity of entities) {
    const entityNodeId = nodeId("entity", entity.name, documentId);
    nodes.set(entityNodeId, {
      nodeId: entityNodeId,
      type: "entity",
      label: entity.name,
      documentId,
      userId,
      metadata: { entityType: entity.type },
    });

    const mentionEdgeId = edgeId(docNodeId, "MENTIONS", entityNodeId);
    edges.set(mentionEdgeId, {
      edgeId: mentionEdgeId,
      sourceId: docNodeId,
      targetId: entityNodeId,
      type: "MENTIONS",
      documentId,
      userId,
    });
  }

  for (const rel of relationships) {
    const sourceNodeId = nodeId("entity", rel.source, documentId);
    const targetNodeId = nodeId("entity", rel.target, documentId);

    if (!nodes.has(sourceNodeId)) {
      nodes.set(sourceNodeId, {
        nodeId: sourceNodeId,
        type: "entity",
        label: rel.source,
        documentId,
        userId,
      });
    }

    if (!nodes.has(targetNodeId)) {
      nodes.set(targetNodeId, {
        nodeId: targetNodeId,
        type: "entity",
        label: rel.target,
        documentId,
        userId,
      });
    }

    const relEdgeId = edgeId(sourceNodeId, rel.type, targetNodeId);
    edges.set(relEdgeId, {
      edgeId: relEdgeId,
      sourceId: sourceNodeId,
      targetId: targetNodeId,
      type: rel.type,
      documentId,
      userId,
    });
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };
}

/** Persist knowledge graph to MongoDB */
export async function persistKnowledgeGraph(
  documentId: string,
  userId: string,
  nodes: KnowledgeGraphNodeData[],
  edges: KnowledgeGraphEdgeData[]
): Promise<void> {
  if (!env.ENABLE_KNOWLEDGE_GRAPH) return;

  await KnowledgeGraphNodeModel.deleteMany({ documentId, userId });
  await KnowledgeGraphEdgeModel.deleteMany({ documentId, userId });

  if (nodes.length > 0) {
    await KnowledgeGraphNodeModel.insertMany(nodes, { ordered: false });
  }

  if (edges.length > 0) {
    await KnowledgeGraphEdgeModel.insertMany(edges, { ordered: false });
  }

  resetGraphRetrievalCache();
}

/** Delete knowledge graph for a document */
export async function deleteKnowledgeGraph(
  documentId: string,
  userId: string
): Promise<void> {
  await KnowledgeGraphNodeModel.deleteMany({ documentId, userId });
  await KnowledgeGraphEdgeModel.deleteMany({ documentId, userId });
  resetGraphRetrievalCache();
}

/** Query neighbors for future graph retrieval */
export async function getGraphNeighbors(
  userId: string,
  nodeIdValue: string,
  limit = 20
): Promise<{ nodes: KnowledgeGraphNodeData[]; edges: KnowledgeGraphEdgeData[] }> {
  const edges = await KnowledgeGraphEdgeModel.find({
    userId,
    $or: [{ sourceId: nodeIdValue }, { targetId: nodeIdValue }],
  })
    .limit(limit)
    .lean();

  const nodeIds = new Set<string>();
  for (const edge of edges) {
    nodeIds.add(edge.sourceId);
    nodeIds.add(edge.targetId);
  }

  const nodes = await KnowledgeGraphNodeModel.find({
    userId,
    nodeId: { $in: [...nodeIds] },
  }).lean();

  return {
    nodes: nodes as KnowledgeGraphNodeData[],
    edges: edges as KnowledgeGraphEdgeData[],
  };
}
