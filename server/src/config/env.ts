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

  /** Mistral AI — required for embeddings and chat/RAG */
  MISTRAL_API_KEY: requireEnv("MISTRAL_API_KEY"),
  /** Default embedding model (1024-dim vectors) */
  MISTRAL_EMBEDDING_MODEL:
    process.env.MISTRAL_EMBEDDING_MODEL || "mistral-embed",
  /** Default chat model for RAG answer generation */
  MISTRAL_CHAT_MODEL:
    process.env.MISTRAL_CHAT_MODEL || "mistral-small-latest",

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
  RAG_MIN_SCORE: parseFloat(process.env.RAG_MIN_SCORE || "0.15"),
<<<<<<< HEAD
=======

  /** AI answer generation — context and output limits */
  MAX_CONTEXT_TOKENS: parseInt(process.env.MAX_CONTEXT_TOKENS || "4000", 10),
  MAX_OUTPUT_TOKENS: parseInt(process.env.MAX_OUTPUT_TOKENS || "1024", 10),
  /** Chat temperature (0 = deterministic, 1 = creative) */
  MISTRAL_CHAT_TEMPERATURE: parseFloat(
    process.env.MISTRAL_CHAT_TEMPERATURE ||
      process.env.OPENAI_TEMPERATURE ||
      "0.2"
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
  ENABLE_YOUTUBE_IMPORT:
    process.env.ENABLE_YOUTUBE_IMPORT !== "false",
  MAX_TRANSCRIPT_SIZE: parseInt(
    process.env.MAX_TRANSCRIPT_SIZE || "500000",
    10
  ),
  MAX_VIDEO_DURATION_SECONDS: parseInt(
    process.env.MAX_VIDEO_DURATION || "14400",
    10
  ),
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
};
