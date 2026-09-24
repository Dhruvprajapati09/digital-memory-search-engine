import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  MONGO_URI: requireEnv("MONGO_URI"),
  JWT_SECRET: requireEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10),

  /** Mistral AI — required for embeddings */
  MISTRAL_API_KEY: requireEnv("MISTRAL_API_KEY"),
  /** Default embedding model (1024-dim vectors) */
  MISTRAL_EMBEDDING_MODEL:
    process.env.MISTRAL_EMBEDDING_MODEL || "mistral-embed",
  /** Embedding throughput controls for provider rate limits */
  MISTRAL_EMBEDDING_BATCH_SIZE: parseInt(
    process.env.MISTRAL_EMBEDDING_BATCH_SIZE || "4",
    10
  ),
  MISTRAL_EMBEDDING_BATCH_DELAY_MS: parseInt(
    process.env.MISTRAL_EMBEDDING_BATCH_DELAY_MS || "1200",
    10
  ),
  MISTRAL_EMBEDDING_MAX_RETRIES: parseInt(
    process.env.MISTRAL_EMBEDDING_MAX_RETRIES || "6",
    10
  ),
  MISTRAL_EMBEDDING_RETRY_BASE_DELAY_MS: parseInt(
    process.env.MISTRAL_EMBEDDING_RETRY_BASE_DELAY_MS || "2000",
    10
  ),
  /** Groq — chat/RAG answer generation */
  GROQ_API_KEY: requireEnv("GROQ_API_KEY"),
  GROQ_CHAT_MODEL: process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile",

  /** Pinecone — required for vector storage and similarity search */
  PINECONE_API_KEY: requireEnv("PINECONE_API_KEY"),
  PINECONE_INDEX_NAME: requireEnv("PINECONE_INDEX_NAME"),
  /** Optional namespace for multi-tenant isolation within one index */
  PINECONE_NAMESPACE: process.env.PINECONE_NAMESPACE || "",
  /** Must match your Pinecone index dimension (mistral-embed default = 1024) */
  PINECONE_EMBEDDING_DIMENSION: parseInt(
    process.env.PINECONE_EMBEDDING_DIMENSION || "1024",
    10
  ),

  /** Max tokens per topic chunk before splitting (default 512) */
  CHUNK_MAX_TOKENS: parseInt(process.env.CHUNK_MAX_TOKENS || "512", 10),

  /** RAG retrieval defaults */
  RAG_TOP_K: parseInt(process.env.RAG_TOP_K || "8", 10),
  RAG_MIN_SCORE: parseFloat(process.env.RAG_MIN_SCORE || "0.08"),

  /** Unified retrieval pipeline (search + RAG) */
  RETRIEVAL_TOP_K: parseInt(process.env.RETRIEVAL_TOP_K || "60", 10),
  SEARCH_TOP_K: parseInt(process.env.SEARCH_TOP_K || "20", 10),
  MIN_VECTOR_SCORE: parseFloat(process.env.MIN_VECTOR_SCORE || "0.08"),
  /** Precision gates: avoid filling search/RAG results with weakly related chunks */
  ENABLE_PRECISION_FILTER:
    process.env.ENABLE_PRECISION_FILTER !== "false",
  PRECISION_MIN_VECTOR_SCORE: parseFloat(
    process.env.PRECISION_MIN_VECTOR_SCORE || "0.72"
  ),
  PRECISION_STRONG_VECTOR_SCORE: parseFloat(
    process.env.PRECISION_STRONG_VECTOR_SCORE || "0.86"
  ),
  PRECISION_MIN_KEYWORD_OVERLAP: parseFloat(
    process.env.PRECISION_MIN_KEYWORD_OVERLAP || "0.5"
  ),
  PRECISION_MIN_METADATA_OVERLAP: parseFloat(
    process.env.PRECISION_MIN_METADATA_OVERLAP || "0.34"
  ),
  PRECISION_MIN_TITLE_OVERLAP: parseFloat(
    process.env.PRECISION_MIN_TITLE_OVERLAP || "0.5"
  ),
  PRECISION_DEDUPE_SIMILARITY: parseFloat(
    process.env.PRECISION_DEDUPE_SIMILARITY || "0.82"
  ),
  /** Softer precision vector floor for Assistant RAG only (Search stays at PRECISION_MIN_VECTOR_SCORE) */
  RAG_PRECISION_MIN_VECTOR_SCORE: parseFloat(
    process.env.RAG_PRECISION_MIN_VECTOR_SCORE || "0.55"
  ),
  RRF_K: parseInt(process.env.RRF_K || "60", 10),
  RRF_WEIGHT_VECTOR: parseFloat(process.env.RRF_WEIGHT_VECTOR || "0.6"),
  RRF_WEIGHT_KEYWORD: parseFloat(process.env.RRF_WEIGHT_KEYWORD || "0.4"),
  /** Fetch extra candidates before grouping documents for pagination */
  RETRIEVAL_MULTIPLIER: parseInt(process.env.RETRIEVAL_MULTIPLIER || "8", 10),

  /** Query intelligence (Phase 2) */
  QUERY_EXPANSION_LIMIT: parseInt(process.env.QUERY_EXPANSION_LIMIT || "20", 10),
  ENABLE_QUERY_EXPANSION: process.env.ENABLE_QUERY_EXPANSION !== "false",
  ENABLE_ENTITY_EXTRACTION: process.env.ENABLE_ENTITY_EXTRACTION !== "false",
  ENABLE_METADATA_HINTS: process.env.ENABLE_METADATA_HINTS !== "false",

  /** Context assembly (Phase 3) */
  ENABLE_CONTEXT_EXPANSION: process.env.ENABLE_CONTEXT_EXPANSION !== "false",
  CONTEXT_NEIGHBOR_COUNT: parseInt(process.env.CONTEXT_NEIGHBOR_COUNT || "1", 10),
  MAX_CONTEXT_CHUNKS: parseInt(process.env.MAX_CONTEXT_CHUNKS || "15", 10),
  ENABLE_DUPLICATE_REMOVAL: process.env.ENABLE_DUPLICATE_REMOVAL !== "false",

  /** Cross-encoder reranking (Phase 4) */
  ENABLE_RERANKER: process.env.ENABLE_RERANKER !== "false",
  RERANK_PROVIDER: process.env.RERANK_PROVIDER || "bge",
  RERANK_TOP_K: parseInt(process.env.RERANK_TOP_K || "15", 10),
  RETRIEVAL_CANDIDATES: parseInt(process.env.RETRIEVAL_CANDIDATES || "100", 10),
  /** Knowledge graph retrieval (Phase 5) */
  ENABLE_GRAPH_RETRIEVAL: process.env.ENABLE_GRAPH_RETRIEVAL !== "false",
  GRAPH_RETRIEVAL_MAX_DEPTH: parseInt(
    process.env.GRAPH_RETRIEVAL_MAX_DEPTH || "2",
    10
  ),
  GRAPH_RETRIEVAL_CANDIDATES: parseInt(
    process.env.GRAPH_RETRIEVAL_CANDIDATES || "60",
    10
  ),
  GRAPH_RETRIEVAL_CACHE_TTL_MS: parseInt(
    process.env.GRAPH_RETRIEVAL_CACHE_TTL_MS || "300000",
    10
  ),
  GRAPH_RRF_WEIGHT: parseFloat(process.env.GRAPH_RRF_WEIGHT || "0.25"),
  /** Search v2 cache/analytics infrastructure */
  REDIS_URL: process.env.REDIS_URL || "",
  ENABLE_SEARCH_CACHE: process.env.ENABLE_SEARCH_CACHE !== "false",
  SEARCH_RESULT_CACHE_TTL_MS: parseInt(
    process.env.SEARCH_RESULT_CACHE_TTL_MS || "120000",
    10
  ),
  SEARCH_SUGGESTION_CACHE_TTL_MS: parseInt(
    process.env.SEARCH_SUGGESTION_CACHE_TTL_MS || "300000",
    10
  ),
  RERANK_TIMEOUT_MS: parseInt(process.env.RERANK_TIMEOUT_MS || "10000", 10),
  RERANK_BATCH_SIZE: parseInt(process.env.RERANK_BATCH_SIZE || "32", 10),
  /** Retries after transient provider failures (timeouts are not retried) */
  RERANK_MAX_RETRIES: parseInt(process.env.RERANK_MAX_RETRIES || "2", 10),
  FINAL_SCORE_WEIGHT_RERANK: parseFloat(
    process.env.FINAL_SCORE_WEIGHT_RERANK || "0.70"
  ),
  FINAL_SCORE_WEIGHT_HYBRID: parseFloat(
    process.env.FINAL_SCORE_WEIGHT_HYBRID || "0.15"
  ),
  FINAL_SCORE_WEIGHT_KEYWORD: parseFloat(
    process.env.FINAL_SCORE_WEIGHT_KEYWORD || "0.05"
  ),
  FINAL_SCORE_WEIGHT_METADATA: parseFloat(
    process.env.FINAL_SCORE_WEIGHT_METADATA || "0.05"
  ),
  FINAL_SCORE_WEIGHT_RECENCY: parseFloat(
    process.env.FINAL_SCORE_WEIGHT_RECENCY || "0.05"
  ),
  ENABLE_SEARCH_DEBUG: process.env.ENABLE_SEARCH_DEBUG === "true",
  /** Hugging Face Inference API — BAAI/bge-reranker-v2-m3 */
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY || "",
  BGE_RERANK_MODEL:
    process.env.BGE_RERANK_MODEL || "BAAI/bge-reranker-v2-m3",
  /** Jina AI Reranker API */
  JINA_API_KEY: process.env.JINA_API_KEY || "",
  JINA_RERANK_MODEL:
    process.env.JINA_RERANK_MODEL || "jina-reranker-v2-base-multilingual",
  /** Cohere Rerank API */
  COHERE_API_KEY: process.env.COHERE_API_KEY || "",
  COHERE_RERANK_MODEL: process.env.COHERE_RERANK_MODEL || "rerank-v3.5",

  /** AI answer generation — context and output limits */
  MAX_CONTEXT_TOKENS: parseInt(process.env.MAX_CONTEXT_TOKENS || "4000", 10),
  MAX_OUTPUT_TOKENS: parseInt(process.env.MAX_OUTPUT_TOKENS || "1024", 10),
  /** Chat temperature (0 = deterministic, 1 = creative) */
  GROQ_CHAT_TEMPERATURE: parseFloat(
    process.env.GROQ_CHAT_TEMPERATURE || "0.2"
  ),
  /** LLM request timeout in milliseconds */
  AI_REQUEST_TIMEOUT_MS: parseInt(
    process.env.AI_REQUEST_TIMEOUT_MS || "60000",
    10
  ),
  /** Max question length accepted by AI endpoints */
  AI_MAX_QUESTION_LENGTH: parseInt(
    process.env.AI_MAX_QUESTION_LENGTH || "2000",
    10
  ),

  /** YouTube video import (Milestone 9) */
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || "",
  ENABLE_YOUTUBE_IMPORT: process.env.ENABLE_YOUTUBE_IMPORT !== "false",
  MAX_TRANSCRIPT_SIZE: parseInt(process.env.MAX_TRANSCRIPT_SIZE || "500000", 10),
  MAX_VIDEO_DURATION_SECONDS: parseInt(process.env.MAX_VIDEO_DURATION || "14400", 10),

  /** Document intelligence indexing (Phase 5) */
  ENABLE_LAYOUT_ANALYSIS: process.env.ENABLE_LAYOUT_ANALYSIS !== "false",
  ENABLE_ENTITY_EXTRACTION_INDEX:
    process.env.ENABLE_ENTITY_EXTRACTION_INDEX !== "false",
  ENABLE_RELATIONSHIP_EXTRACTION:
    process.env.ENABLE_RELATIONSHIP_EXTRACTION !== "false",
  ENABLE_KNOWLEDGE_GRAPH: process.env.ENABLE_KNOWLEDGE_GRAPH !== "false",
  ENABLE_INCREMENTAL_INDEXING:
    process.env.ENABLE_INCREMENTAL_INDEXING !== "false",
  ENABLE_TABLE_ANALYSIS: process.env.ENABLE_TABLE_ANALYSIS !== "false",
  ENABLE_IMAGE_ANALYSIS: process.env.ENABLE_IMAGE_ANALYSIS !== "false",
  ENABLE_CODE_ANALYSIS: process.env.ENABLE_CODE_ANALYSIS !== "false",
  ENABLE_INDEX_VALIDATION: process.env.ENABLE_INDEX_VALIDATION !== "false",
  /** Current embedding schema version for re-indexing support */
  EMBEDDING_VERSION: process.env.EMBEDDING_VERSION || "1.0.0",
  INDEX_VERSION: parseInt(process.env.INDEX_VERSION || "1", 10),
  /** Parallel chunk processing during indexing */
  INDEXING_CONCURRENCY: parseInt(process.env.INDEXING_CONCURRENCY || "4", 10),
};
