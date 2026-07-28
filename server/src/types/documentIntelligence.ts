import type { ChunkLevel, TopicChunk } from "./chunking";

/** Structural element types detected during document intelligence */
export type StructureElementType =
  | "title"
  | "heading"
  | "subheading"
  | "section"
  | "paragraph"
  | "list"
  | "table"
  | "figure"
  | "caption"
  | "code_block";

/** Entity categories extracted at index time */
export type IndexEntityType =
  | "person"
  | "company"
  | "organization"
  | "framework"
  | "library"
  | "programming_language"
  | "database"
  | "function"
  | "class"
  | "rest_api"
  | "url"
  | "package"
  | "interface"
  | "other";

export interface ExtractedEntity {
  name: string;
  type: IndexEntityType;
}

export interface ExtractedRelationship {
  source: string;
  target: string;
  type: string;
}

export interface PageRange {
  start: number;
  end: number;
}

export interface PageContent {
  pageNumber: number;
  text: string;
  lineStart: number;
  lineEnd: number;
}

export interface LayoutBlock {
  type: StructureElementType;
  text: string;
  pageNumber?: number;
  pageRange?: PageRange;
  lineStart: number;
  lineEnd: number;
  metadata?: Record<string, unknown>;
}

export interface TableStructure {
  headers: string[];
  rows: string[][];
  caption?: string;
  pageNumber?: number;
}

export interface ImageBlock {
  ocrText?: string;
  caption?: string;
  altText?: string;
  pageNumber?: number;
  metadata?: Record<string, unknown>;
}

export interface CodeBlockInfo {
  language?: string;
  classes: string[];
  functions: string[];
  interfaces: string[];
  packages: string[];
  imports: string[];
  apis: string[];
}

export interface DocumentStructureElement {
  type: StructureElementType;
  title: string;
  content: string;
  level: number;
  pageNumber?: number;
  pageRange?: PageRange;
  chapter?: string;
  section?: string;
  heading?: string;
  parentHeading?: string;
  children: DocumentStructureElement[];
  tables?: TableStructure[];
  codeBlocks?: CodeBlockInfo[];
  images?: ImageBlock[];
  lineStart: number;
  lineEnd: number;
}

/** Semantic chunk with Phase 5 enrichment fields */
export interface SemanticChunk extends TopicChunk {
  pageNumber?: number;
  pageRange?: PageRange;
  pageOffset?: number;
  sourcePage?: number;
  chapter?: string;
  section?: string;
  heading?: string;
  parentHeading?: string;
  entities?: ExtractedEntity[];
  relationships?: ExtractedRelationship[];
  elementType?: StructureElementType;
  language?: string;
  chunkHash?: string;
  embeddingVersion?: string;
  indexVersion?: number;
}

export interface EnrichedChunkFields {
  keywords: string[];
  concepts: string[];
  tags: string[];
  summary: string;
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  language: string;
  embeddingVersion: string;
  embeddingModel: string;
  embeddingDate: Date;
  chunkHash: string;
  indexVersion: number;
}

export interface DocumentIntelligenceInput {
  documentId: string;
  userId: string;
  title: string;
  sourceType: "pdf" | "image" | "note" | "video";
  extractedText: string;
  filePath?: string;
}

export interface DocumentIntelligenceResult {
  chunks: SemanticChunk[];
  structure: DocumentStructureElement;
  pages: PageContent[];
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  language: string;
}

export type IndexValidationIssueType =
  | "missing_embedding"
  | "broken_hierarchy"
  | "duplicate_chunk"
  | "missing_metadata"
  | "orphan_chunk"
  | "relationship_issue";

export interface IndexValidationIssue {
  type: IndexValidationIssueType;
  chunkIndex?: number;
  vectorId?: string;
  message: string;
  severity: "error" | "warning";
}

export interface IndexValidationReport {
  documentId: string;
  valid: boolean;
  issues: IndexValidationIssue[];
  chunkCount: number;
  checkedAt: Date;
}

export interface EmbeddingVersionInfo {
  embeddingModel: string;
  embeddingVersion: string;
  embeddingDate: Date;
  chunkHash: string;
}

export type KnowledgeGraphNodeType =
  | "document"
  | "section"
  | "entity"
  | "topic";

export interface KnowledgeGraphNodeData {
  nodeId: string;
  type: KnowledgeGraphNodeType;
  label: string;
  documentId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeGraphEdgeData {
  edgeId: string;
  sourceId: string;
  targetId: string;
  type: string;
  documentId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface IncrementalIndexPlan {
  unchanged: Array<{ chunkIndex: number; vectorId: string; chunkHash: string }>;
  changed: Array<SemanticChunk & { existingVectorId?: string }>;
  removed: Array<{ chunkIndex: number; vectorId: string }>;
  isFullReindex: boolean;
}

export interface ChunkLevelHierarchy {
  level: ChunkLevel;
  chapter?: string;
  section?: string;
  heading?: string;
  parentHeading?: string;
}
