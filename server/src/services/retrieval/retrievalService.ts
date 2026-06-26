import { generateQueryEmbedding } from "../embeddingService";
import { vectorStore } from "../vectorStoreService";
import { env } from "../../config/env";
import type {
  RetrievalOptions,
  RetrievalResult,
  RetrievedChunk,
} from "../../types/chat";
<<<<<<< HEAD
=======
import { buildContext } from "../ai/contextBuilder";
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)

/**
 * Retrieval service — semantic chunk retrieval for search and RAG.
 *
 * Pipeline: embed query (Mistral) → Pinecone similarity search → hydrate from MongoDB.
 */
export async function retrieveRelevantChunks(
  options: RetrievalOptions
): Promise<RetrievalResult> {
  const trimmed = options.query.trim();

  if (!trimmed) {
    throw new Error("Retrieval query cannot be empty");
  }

  const limit = options.limit ?? env.RAG_TOP_K;
  const minScore = options.minScore ?? env.RAG_MIN_SCORE;

  const embedding = await generateQueryEmbedding(trimmed);

  const hits = await vectorStore.searchVector({
    vector: embedding.vector,
    userId: options.userId,
    limit,
    minScore,
    documentIds: options.documentIds,
    topic: options.topic,
    tags: options.tags,
  });

  const chunks: RetrievedChunk[] = hits.map((hit) => ({
    vectorId: hit.vectorId,
    score: hit.score,
    text: hit.text,
    metadata: hit.metadata,
    topic: hit.topic,
    subtopic: hit.subtopic,
    title: hit.title,
    summary: hit.summary,
    keywords: hit.keywords,
    tags: hit.tags,
    sectionPath: hit.sectionPath,
    contentPreview: hit.contentPreview,
  }));

  return {
    chunks,
    queryEmbeddingModel: embedding.model,
  };
}

/** Format retrieved chunks into a context block for the LLM */
export function buildContextFromChunks(chunks: RetrievedChunk[]): string {
<<<<<<< HEAD
  if (chunks.length === 0) return "";

  return chunks
    .map((chunk, index) => {
      const header = [
        `[Source ${index + 1}]`,
        chunk.title ? `Title: ${chunk.title}` : null,
        chunk.topic ? `Topic: ${chunk.topic}` : null,
        chunk.metadata.documentTitle
          ? `Document: ${chunk.metadata.documentTitle}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ");

      return `${header}\n${chunk.text}`;
    })
    .join("\n\n---\n\n");
=======
  return buildContext(chunks).text;
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
}
