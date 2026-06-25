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
};
