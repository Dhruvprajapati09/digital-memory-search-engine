/**
 * Pinecone index validation and setup helper.
 *
 * Run after creating your Pinecone index in the console:
 *   npx ts-node src/scripts/createVectorIndexes.ts
 *
 * Requires MISTRAL_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME in .env
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import ChunkModel from "../models/Chunk";
import { validatePineconeConnection } from "../services/pinecone/pineconeService";
import { validateMistralEmbeddingConfig } from "../services/embeddingService";

async function main(): Promise<void> {
  console.log("[setup] Validating Mistral embedding API...");
  const mistralInfo = await validateMistralEmbeddingConfig();
  console.log(
    `[setup] Mistral OK — model: ${mistralInfo.model}, dimension: ${mistralInfo.dimension}`
  );

  console.log("[setup] Validating Pinecone connection...");
  const pineconeInfo = await validatePineconeConnection();
  console.log(
    `[setup] Pinecone OK — index: ${pineconeInfo.indexName}, ` +
      `dimension: ${pineconeInfo.dimension}, status: ${pineconeInfo.status}`
  );

  await mongoose.connect(env.MONGO_URI);
  console.log("[setup] Connected to MongoDB");

  await ChunkModel.syncIndexes();
  console.log("[setup] Synced MongoDB text indexes for keyword search");

  console.log(`
Setup complete. Architecture:
  - Embeddings: Mistral (${env.MISTRAL_EMBEDDING_MODEL}, ${env.PINECONE_EMBEDDING_DIMENSION} dims)
  - Vectors:    Pinecone index "${env.PINECONE_INDEX_NAME}"
  - Chunks:     MongoDB (text + metadata for keyword search)
  - Chat/RAG:   Mistral (${env.MISTRAL_CHAT_MODEL})

If you migrated from Gemini/MongoDB vectors, re-index all documents:
  POST /api/documents/:id/reindex for each document
`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[setup] Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
