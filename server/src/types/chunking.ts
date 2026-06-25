/** Hierarchy level for a parsed document section */
export type ChunkLevel = "document" | "topic" | "subtopic" | "semantic";

/** Parsed structural block before chunking */
export interface ParsedSection {
  title: string;
  level: number;
  content: string;
  children: ParsedSection[];
  lineStart: number;
  lineEnd: number;
}

/** Output of topic-aware chunking — one embeddable semantic unit */
export interface TopicChunk {
  chunkIndex: number;
  /** Full chunk body used for embedding */
  text: string;
  title: string;
  topic: string;
  subtopic?: string;
  sectionPath: string[];
  level: ChunkLevel;
  parentChunkIndex?: number;
  tokenCount: number;
  contentPreview: string;
}

/** Options for topic chunking */
export interface TopicChunkingOptions {
  /** Max tokens per semantic chunk before splitting (default 512) */
  maxTokens?: number;
  /** Min tokens to keep a chunk (default 20) */
  minTokens?: number;
  /** Document title used as root topic when no headings detected */
  documentTitle?: string;
}
