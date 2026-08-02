import mongoose from "mongoose";
import ChunkModel from "../../models/Chunk";
import {
  KnowledgeGraphEdgeModel,
  KnowledgeGraphNodeModel,
} from "../../models/KnowledgeGraph";
import { env } from "../../config/env";
import type {
  KnowledgeGraphEdgeData,
  KnowledgeGraphNodeData,
  KnowledgeGraphNodeType,
} from "../../types/documentIntelligence";
import type { VectorMetadata } from "../../types/embedding";
import type {
  GraphRetrievalDebugInfo,
  RankedChunkHit,
} from "../../types/search";
import type { QueryPipelineResult } from "../../types/query";
import type { FusedSearchHit } from "../search/hybridSearchService";

export type GraphNodeMatch = GraphRetrievalDebugInfo["topNodes"][number];

export interface GraphSearchHit extends FusedSearchHit {
  graphScore: number;
  graphConfidence: number;
  graphMatchedNodes: GraphNodeMatch[];
}

export interface GraphRetrievalOptions {
  userId: string;
  queryAnalysis: QueryPipelineResult;
  documentIds?: string[];
  limit?: number;
  maxDepth?: number;
}

export interface GraphRetrievalResult {
  hits: GraphSearchHit[];
  debug: GraphRetrievalDebugInfo;
}

interface ScoredGraphNode extends KnowledgeGraphNodeData {
  score: number;
  depth: number;
}

interface CacheEntry {
  expiresAt: number;
  result: GraphRetrievalResult;
}

type LeanChunkRecord = Record<string, unknown> & {
  _id: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  chunkIndex: number;
  text: string;
  vectorId: string;
};

const graphCache = new Map<string, CacheEntry>();

const NODE_TYPE_WEIGHT: Record<KnowledgeGraphNodeType, number> = {
  entity: 1,
  section: 0.85,
  topic: 0.75,
  document: 0.4,
};

const EDGE_TYPE_WEIGHT: Record<string, number> = {
  CONTAINS: 0.8,
  HAS_SECTION: 0.9,
  MENTIONS: 0.7,
};

const DEFAULT_EDGE_WEIGHT = 0.65;
const DEPTH_DECAY = 0.72;
const MAX_SEED_TERMS = 32;
const MAX_DEBUG_NODES = 10;

export function normalizeGraphLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function calculateGraphConfidence(
  score: number,
  matchedNodeCount: number,
  nearestDepth: number
): number {
  const boundedScore = Math.max(0, Math.min(1, score));
  const breadthScore = Math.min(1, matchedNodeCount / 3);
  const depthPenalty = nearestDepth === 0 ? 1 : Math.pow(0.85, nearestDepth);
  const confidence = (boundedScore * 0.75 + breadthScore * 0.25) * depthPenalty;

  return Math.round(Math.max(0, Math.min(1, confidence)) * 1000) / 1000;
}

export function buildGraphSeedTerms(
  queryAnalysis: QueryPipelineResult
): string[] {
  const terms = new Set<string>();

  const add = (value?: string): void => {
    if (!value) return;
    const normalized = normalizeGraphLabel(value);
    if (normalized.length >= 2) {
      terms.add(normalized);
    }
  };

  add(queryAnalysis.normalized);
  add(queryAnalysis.metadataHints.topic);

  for (const entity of queryAnalysis.entities) add(entity);
  for (const keyword of queryAnalysis.keywords) add(keyword);
  for (const term of queryAnalysis.expandedTerms) add(term);

  return [...terms].slice(0, MAX_SEED_TERMS);
}

export function resetGraphRetrievalCache(): void {
  graphCache.clear();
}

/** Test helper: current in-memory graph cache entry count */
export function getGraphRetrievalCacheSize(): number {
  return graphCache.size;
}

export function buildGraphCacheKey(options: GraphRetrievalOptions): string {
  const sorted = (values: string[]) =>
    [...values].map((v) => v.toLowerCase()).sort();

  return JSON.stringify({
    userId: options.userId,
    q: options.queryAnalysis.normalized,
    entities: sorted(options.queryAnalysis.entities),
    keywords: sorted(options.queryAnalysis.keywords),
    expandedTerms: sorted(options.queryAnalysis.expandedTerms),
    topic: options.queryAnalysis.metadataHints.topic ?? null,
    documentIds: [...(options.documentIds ?? [])].sort(),
    limit: options.limit ?? env.GRAPH_RETRIEVAL_CANDIDATES,
    maxDepth: options.maxDepth ?? env.GRAPH_RETRIEVAL_MAX_DEPTH,
  });
}

function cloneResult(result: GraphRetrievalResult): GraphRetrievalResult {
  return {
    hits: result.hits.map((hit) => ({ ...hit })),
    debug: {
      ...result.debug,
      topNodes: result.debug.topNodes.map((node) => ({ ...node })),
    },
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toObjectIds(ids: string[]): mongoose.Types.ObjectId[] {
  return ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

function edgeWeight(edge: KnowledgeGraphEdgeData): number {
  return EDGE_TYPE_WEIGHT[edge.type] ?? DEFAULT_EDGE_WEIGHT;
}

function toDebugNode(node: ScoredGraphNode): GraphNodeMatch {
  return {
    nodeId: node.nodeId,
    type: node.type,
    label: node.label,
    score: Math.round(node.score * 1000) / 1000,
    depth: node.depth,
  };
}

async function loadSeedNodes(
  options: GraphRetrievalOptions,
  seedTerms: string[],
  limit: number
): Promise<ScoredGraphNode[]> {
  if (seedTerms.length === 0) return [];

  const filter: Record<string, unknown> = {
    userId: options.userId,
    $or: seedTerms.map((term) => ({
      label: { $regex: escapeRegex(term), $options: "i" },
    })),
  };

  if (options.documentIds && options.documentIds.length > 0) {
    filter.documentId = { $in: options.documentIds };
  }

  const nodes = await KnowledgeGraphNodeModel.find(filter)
    .limit(Math.max(limit, seedTerms.length * 4))
    .lean();

  const scored = new Map<string, ScoredGraphNode>();

  for (const node of nodes as KnowledgeGraphNodeData[]) {
    const label = normalizeGraphLabel(node.label);
    const matched = seedTerms.some(
      (term) => label === term || label.includes(term) || term.includes(label)
    );

    const baseScore = matched ? 1 : 0.75;
    const existing = scored.get(node.nodeId);
    const next: ScoredGraphNode = {
      ...node,
      score: Math.max(existing?.score ?? 0, baseScore),
      depth: 0,
    };
    scored.set(node.nodeId, next);
  }

  return [...scored.values()].sort((a, b) => b.score - a.score);
}

async function traverseGraph(
  userId: string,
  seedNodes: ScoredGraphNode[],
  maxDepth: number
): Promise<{ nodes: ScoredGraphNode[]; edgeCount: number }> {
  const scored = new Map<string, ScoredGraphNode>();
  let frontier = seedNodes;
  let edgeCount = 0;

  for (const node of seedNodes) {
    scored.set(node.nodeId, node);
  }

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const frontierIds = frontier.map((node) => node.nodeId);
    const edges = (await KnowledgeGraphEdgeModel.find({
      userId,
      $or: [
        { sourceId: { $in: frontierIds } },
        { targetId: { $in: frontierIds } },
      ],
    })
      .limit(env.GRAPH_RETRIEVAL_CANDIDATES * 4)
      .lean()) as KnowledgeGraphEdgeData[];

    edgeCount += edges.length;

    const neighborIds = new Set<string>();
    const bestNeighborScore = new Map<string, number>();

    for (const edge of edges) {
      const sourceScore = scored.get(edge.sourceId)?.score ?? 0;
      const targetScore = scored.get(edge.targetId)?.score ?? 0;

      if (sourceScore > 0) {
        const score = sourceScore * edgeWeight(edge) * DEPTH_DECAY;
        neighborIds.add(edge.targetId);
        bestNeighborScore.set(
          edge.targetId,
          Math.max(bestNeighborScore.get(edge.targetId) ?? 0, score)
        );
      }

      if (targetScore > 0) {
        const score = targetScore * edgeWeight(edge) * DEPTH_DECAY;
        neighborIds.add(edge.sourceId);
        bestNeighborScore.set(
          edge.sourceId,
          Math.max(bestNeighborScore.get(edge.sourceId) ?? 0, score)
        );
      }
    }

    const newIds = [...neighborIds].filter((id) => !scored.has(id));
    if (newIds.length === 0) break;

    const neighbors = (await KnowledgeGraphNodeModel.find({
      userId,
      nodeId: { $in: newIds },
    })
      .limit(env.GRAPH_RETRIEVAL_CANDIDATES * 4)
      .lean()) as KnowledgeGraphNodeData[];

    frontier = neighbors.map((node) => ({
      ...node,
      score: bestNeighborScore.get(node.nodeId) ?? 0,
      depth,
    }));

    for (const node of frontier) {
      const existing = scored.get(node.nodeId);
      if (!existing || node.score > existing.score) {
        scored.set(node.nodeId, node);
      }
    }
  }

  return {
    nodes: [...scored.values()].sort((a, b) => b.score - a.score),
    edgeCount,
  };
}

function exactRegex(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value)}$`, "i");
}

function buildChunkQuery(
  userId: string,
  nodes: ScoredGraphNode[],
  documentIds?: string[]
): Record<string, unknown> | null {
  const scopedDocumentIds = documentIds && documentIds.length > 0
    ? documentIds
    : [...new Set(nodes.map((node) => node.documentId))];

  const objectIds = toObjectIds(scopedDocumentIds);
  if (objectIds.length === 0) return null;

  const userFilter = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId;

  const or: Record<string, unknown>[] = [];

  for (const node of nodes.slice(0, env.GRAPH_RETRIEVAL_CANDIDATES)) {
    const label = exactRegex(node.label);

    switch (node.type) {
      case "document":
        if (mongoose.Types.ObjectId.isValid(node.documentId)) {
          or.push({ documentId: new mongoose.Types.ObjectId(node.documentId) });
        }
        break;
      case "topic":
        or.push({ topic: label }, { sectionPath: label });
        break;
      case "section":
        or.push({ section: label }, { heading: label }, { sectionPath: label });
        break;
      case "entity":
        or.push({ "entities.name": label });
        break;
      default:
        break;
    }
  }

  return {
    userId: userFilter,
    documentId: { $in: objectIds },
    ...(or.length > 0 ? { $or: or } : {}),
  };
}

function storedMetadata(chunk: LeanChunkRecord): Record<string, unknown> {
  return (chunk.metadata as Record<string, unknown> | undefined) ?? {};
}

function chunkDocumentId(chunk: LeanChunkRecord): string {
  return String(chunk.documentId);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function chunkMatchesNode(
  chunk: LeanChunkRecord,
  node: ScoredGraphNode
): boolean {
  if (chunkDocumentId(chunk) !== node.documentId) return false;

  const label = normalizeGraphLabel(node.label);
  const equalsLabel = (value?: unknown): boolean =>
    typeof value === "string" && normalizeGraphLabel(value) === label;

  switch (node.type) {
    case "document":
      return true;
    case "topic":
      return (
        equalsLabel(chunk.topic) ||
        stringArray(chunk.sectionPath).some((item) => equalsLabel(item))
      );
    case "section":
      return (
        equalsLabel(chunk.section) ||
        equalsLabel(chunk.heading) ||
        stringArray(chunk.sectionPath).some((item) => equalsLabel(item))
      );
    case "entity":
      if (!Array.isArray(chunk.entities)) return false;
      return (chunk.entities as Array<{ name?: string }>)
        .map((entity) => entity.name)
        .filter((name): name is string => Boolean(name))
        .some((item) => equalsLabel(item));
    default:
      return false;
  }
}

function scoreChunk(
  chunk: LeanChunkRecord,
  nodes: ScoredGraphNode[]
): { score: number; confidence: number; matchedNodes: GraphNodeMatch[] } {
  let rawScore = 0;
  let nearestDepth = Number.MAX_SAFE_INTEGER;
  const matchedNodes: GraphNodeMatch[] = [];

  for (const node of nodes) {
    if (!chunkMatchesNode(chunk, node)) continue;

    const typeWeight = NODE_TYPE_WEIGHT[node.type];
    const depthBoost = node.depth === 0 ? 1.15 : 1;
    rawScore += node.score * typeWeight * depthBoost;
    nearestDepth = Math.min(nearestDepth, node.depth);
    matchedNodes.push(toDebugNode(node));
  }

  const score = Math.round((1 - Math.exp(-rawScore)) * 1000) / 1000;
  const confidence = calculateGraphConfidence(
    score,
    matchedNodes.length,
    nearestDepth === Number.MAX_SAFE_INTEGER ? 0 : nearestDepth
  );

  return {
    score,
    confidence,
    matchedNodes: matchedNodes
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_DEBUG_NODES),
  };
}

function mapChunkToGraphHit(
  chunk: LeanChunkRecord,
  graphScore: number,
  graphConfidence: number,
  matchedNodes: GraphNodeMatch[]
): GraphSearchHit {
  const meta = storedMetadata(chunk);
  const documentId = chunkDocumentId(chunk);
  const chunkIndex = chunk.chunkIndex;
  const metadata: VectorMetadata = {
    ...meta,
    documentId,
    userId: String(chunk.userId),
    chunkIndex,
    type: (meta.type as string) ?? (chunk.sourceType as string),
    documentTitle: meta.documentTitle as string | undefined,
    topic: (chunk.topic as string | undefined) ?? (meta.topic as string | undefined),
    subtopic: chunk.subtopic as string | undefined,
    title: chunk.title as string | undefined,
    summary: chunk.summary as string | undefined,
    keywords: stringArray(chunk.keywords),
    concepts: stringArray(chunk.concepts),
    tags: stringArray(chunk.tags),
    sectionPath: stringArray(chunk.sectionPath),
    contentPreview: chunk.contentPreview as string | undefined,
    level: chunk.level as string | undefined,
    parentChunkIndex: chunk.parentChunkIndex as number | undefined,
    parentChunkId: chunk.parentChunkId ? String(chunk.parentChunkId) : undefined,
    chapter: chunk.chapter as string | undefined,
    section: chunk.section as string | undefined,
    heading: chunk.heading as string | undefined,
    parentHeading: chunk.parentHeading as string | undefined,
    pageNumber: chunk.pageNumber as number | undefined,
    pageRange: chunk.pageRange as { start: number; end: number } | undefined,
    pageOffset: chunk.pageOffset as number | undefined,
    sourcePage: chunk.sourcePage as number | undefined,
    entities: chunk.entities as VectorMetadata["entities"],
    relationships: chunk.relationships as VectorMetadata["relationships"],
    language: chunk.language as string | undefined,
    embeddingVersion: chunk.embeddingVersion as string | undefined,
    embeddingDate: chunk.embeddingDate
      ? new Date(chunk.embeddingDate as Date).toISOString()
      : undefined,
    chunkHash: chunk.chunkHash as string | undefined,
    indexVersion: chunk.indexVersion as number | undefined,
  };

  return {
    vectorId: chunk.vectorId || String(chunk._id),
    text: chunk.text,
    metadata,
    vectorScore: 0,
    keywordScore: 0,
    rrfScore: 0,
    graphScore,
    graphConfidence,
    graphMatchedNodes: matchedNodes,
    topic: chunk.topic as string | undefined,
    subtopic: chunk.subtopic as string | undefined,
    title: chunk.title as string | undefined,
    summary: chunk.summary as string | undefined,
    keywords: stringArray(chunk.keywords),
    tags: stringArray(chunk.tags),
    sectionPath: stringArray(chunk.sectionPath),
    contentPreview: chunk.contentPreview as string | undefined,
  };
}

function emptyDebug(
  enabled: boolean,
  startedAt: number,
  maxDepth: number,
  cacheHit = false
): GraphRetrievalDebugInfo {
  return {
    enabled,
    cacheHit,
    latencyMs: Date.now() - startedAt,
    seedNodeCount: 0,
    traversedNodeCount: 0,
    traversedEdgeCount: 0,
    candidateChunkCount: 0,
    maxDepth,
    topNodes: [],
  };
}

export async function retrieveGraphChunks(
  options: GraphRetrievalOptions
): Promise<GraphRetrievalResult> {
  const startedAt = Date.now();
  const maxDepth = Math.max(
    0,
    options.maxDepth ?? env.GRAPH_RETRIEVAL_MAX_DEPTH
  );
  const limit = options.limit ?? env.GRAPH_RETRIEVAL_CANDIDATES;

  if (!env.ENABLE_GRAPH_RETRIEVAL || !env.ENABLE_KNOWLEDGE_GRAPH) {
    return {
      hits: [],
      debug: emptyDebug(false, startedAt, maxDepth),
    };
  }

  const cacheKey = buildGraphCacheKey(options);
  const cached = graphCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    const result = cloneResult(cached.result);
    result.debug.cacheHit = true;
    result.debug.latencyMs = Date.now() - startedAt;
    return result;
  }

  const seedTerms = buildGraphSeedTerms(options.queryAnalysis);
  const seedNodes = await loadSeedNodes(options, seedTerms, limit);

  if (seedNodes.length === 0) {
    // Do not cache empty misses — avoids poisoning the next request
    return {
      hits: [],
      debug: emptyDebug(true, startedAt, maxDepth),
    };
  }

  const traversal = await traverseGraph(options.userId, seedNodes, maxDepth);
  const chunkQuery = buildChunkQuery(
    options.userId,
    traversal.nodes,
    options.documentIds
  );

  if (!chunkQuery) {
    return {
      hits: [],
      debug: {
        enabled: true,
        cacheHit: false,
        latencyMs: Date.now() - startedAt,
        seedNodeCount: seedNodes.length,
        traversedNodeCount: traversal.nodes.length,
        traversedEdgeCount: traversal.edgeCount,
        candidateChunkCount: 0,
        maxDepth,
        topNodes: traversal.nodes.slice(0, MAX_DEBUG_NODES).map(toDebugNode),
      },
    };
  }

  const chunks = (await ChunkModel.find(chunkQuery)
    .limit(limit * 3)
    .lean()) as unknown as LeanChunkRecord[];

  const hits = chunks
    .map((chunk) => {
      const { score, confidence, matchedNodes } = scoreChunk(
        chunk,
        traversal.nodes
      );
      return { chunk, score, confidence, matchedNodes };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) =>
      mapChunkToGraphHit(
        item.chunk,
        item.score,
        item.confidence,
        item.matchedNodes
      )
    );

  const result: GraphRetrievalResult = {
    hits,
    debug: {
      enabled: true,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      seedNodeCount: seedNodes.length,
      traversedNodeCount: traversal.nodes.length,
      traversedEdgeCount: traversal.edgeCount,
      candidateChunkCount: chunks.length,
      maxDepth,
      topNodes: traversal.nodes.slice(0, MAX_DEBUG_NODES).map(toDebugNode),
    },
  };

  // Only cache non-empty graph hits
  if (result.hits.length > 0) {
    graphCache.set(cacheKey, {
      expiresAt: Date.now() + env.GRAPH_RETRIEVAL_CACHE_TTL_MS,
      result: cloneResult(result),
    });
  }

  return result;
}

export function attachGraphDebugToRankedChunks(
  chunks: RankedChunkHit[],
  graphHits: GraphSearchHit[]
): RankedChunkHit[] {
  if (graphHits.length === 0) return chunks;

  const graphById = new Map(graphHits.map((hit) => [hit.vectorId, hit]));
  return chunks.map((chunk) => {
    const graph = graphById.get(chunk.vectorId);
    if (!graph) return chunk;

    return {
      ...chunk,
      graphScore: graph.graphScore,
      graphConfidence: graph.graphConfidence,
      graphMatchedNodes: graph.graphMatchedNodes,
    };
  });
}
