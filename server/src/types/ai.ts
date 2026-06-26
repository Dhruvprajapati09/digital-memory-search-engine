/** Mistral chat message roles supported by the RAG pipeline */
export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionOptions {
  /** Override the default chat model from env */
  model?: string;
  temperature?: number;
  maxTokens?: number;
<<<<<<< HEAD
=======
  /** Abort signal for timeout handling */
  signal?: AbortSignal;
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
}

export interface ChatCompletionResult {
  answer: string;
  model: string;
<<<<<<< HEAD
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
=======
  usage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
}

export interface EmbeddingTaskType {
  /** Document indexing — embeds content for storage */
  kind: "document";
}

export interface QueryEmbeddingTaskType {
  /** Search/RAG query — embeds user question for retrieval */
  kind: "query";
}

export type EmbeddingInputType = EmbeddingTaskType | QueryEmbeddingTaskType;
<<<<<<< HEAD
=======

/** POST /api/ai/ask request body */
export interface AskRequest {
  question: string;
  topK?: number;
  /** Limit retrieval to specific documents (optional) */
  documentIds?: string[];
}

/** Source citation attached to every AI answer */
export interface AiSource {
  documentId: string;
  documentName: string;
  type?: "document" | "video";
  page?: number;
  chunkId: string;
  chunkIndex: number;
  score: number;
  highlightedText: string;
  topic?: string;
  title?: string;
  /** Video citation fields */
  channel?: string;
  timestamp?: string;
  timestampSeconds?: number;
  videoUrl?: string;
  youtubeVideoId?: string;
}

/** Chunk detail returned alongside sources for source viewer */
export interface AiChunkDetail {
  chunkId: string;
  chunkIndex: number;
  documentId: string;
  documentName: string;
  type?: "document" | "video";
  score: number;
  text: string;
  topic?: string;
  title?: string;
  page?: number;
  channel?: string;
  timestamp?: string;
  timestampSeconds?: number;
  videoUrl?: string;
  youtubeVideoId?: string;
}

/** POST /api/ai/ask response */
export interface AskResponse {
  success: boolean;
  answer: string;
  sources: AiSource[];
  chunks: AiChunkDetail[];
  processingTime: number;
  model: string;
  usage: TokenUsage;
  /** True when no relevant chunks were retrieved */
  noResults: boolean;
}

/** POST /api/ai/summary/:documentId response */
export interface DocumentSummaryResponse {
  success: boolean;
  title: string;
  documentId: string;
  summary: string;
  topics: string[];
  keywords: string[];
  concepts: string[];
  highlights: string[];
  processingTime: number;
  model: string;
  usage: TokenUsage;
}

export interface BuiltContext {
  /** Joined context string for the LLM prompt */
  text: string;
  /** Chunks included after dedup, sort, and token limiting */
  chunks: import("./chat").RetrievedChunk[];
  estimatedTokens: number;
}
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
