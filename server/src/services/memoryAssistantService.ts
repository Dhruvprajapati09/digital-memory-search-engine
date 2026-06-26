import { GoogleGenAI } from "@google/genai";
import DocumentModel from "../models/Document";
import type { DocumentType } from "../models/Document";
import { AppError } from "../middleware/error.middleware";
import { generateQueryEmbedding } from "./embeddingService";
import { vectorStore } from "./vectorStoreService";
import { tokenizeQuery } from "./rankingService";
import { env } from "../config/env";

export interface MemoryCitation {
  documentId: string;
  title: string;
  type: DocumentType;
  chunkIndex: number;
  score: number;
  text: string;
}

export interface MemoryAnswer {
  success: boolean;
  query: string;
  answer: string;
  citations: MemoryCitation[];
  model: string;
}

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  return geminiClient;
}

function validateQuestion(question: string): string {
  const trimmed = question.trim();

  if (!trimmed) {
    throw new AppError("Question is required", 400);
  }

  if (trimmed.length > 1000) {
    throw new AppError("Question must be at most 1000 characters", 400);
  }

  return trimmed;
}

function sentenceSplit(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildExtractiveAnswer(question: string, citations: MemoryCitation[]) {
  const queryTerms = new Set(tokenizeQuery(question));
  const sentences = citations.flatMap((citation) =>
    sentenceSplit(citation.text).map((sentence) => ({ sentence, citation }))
  );

  const ranked = sentences
    .map((item) => {
      const lower = item.sentence.toLowerCase();
      const matches = [...queryTerms].filter((term) => lower.includes(term));
      return {
        ...item,
        score: matches.length + item.citation.score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (ranked.length === 0) {
    return "I found related memories, but there was not enough readable text to form a grounded answer.";
  }

  return ranked
    .map(
      (item) =>
        `${item.sentence} [${item.citation.title}, chunk ${item.citation.chunkIndex + 1}]`
    )
    .join(" ");
}

async function generateGeminiAnswer(
  question: string,
  citations: MemoryCitation[]
): Promise<string | null> {
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  const context = citations
    .map(
      (citation, index) =>
        `[${index + 1}] ${citation.title} / chunk ${citation.chunkIndex + 1}\n${citation.text}`
    )
    .join("\n\n");

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: process.env.GEMINI_LLM_MODEL || "gemini-2.5-flash",
      contents: `Answer the user's question using only the memory context below. If the context is insufficient, say what is missing. Include bracketed source numbers when useful.\n\nMemory context:\n${context}\n\nQuestion: ${question}`,
    });

    const text = response.text?.trim();
    return text || null;
  } catch (err) {
    console.warn(
      "[memoryAssistantService] Gemini answer failed, using fallback:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function answerFromMemory(
  userId: string,
  rawQuestion: string
): Promise<MemoryAnswer> {
  const question = validateQuestion(rawQuestion);
  const embedding = await generateQueryEmbedding(question);
  const hits = await vectorStore.searchVector({
    vector: embedding.vector,
    userId,
    limit: 8,
    minScore: 0.05,
  });

  const documentIds = [...new Set(hits.map((hit) => hit.metadata.documentId))];
  const documents = await DocumentModel.find({
    _id: { $in: documentIds },
    userId,
  })
    .select("_id title type")
    .lean();

  const documentMap = new Map(
    documents.map((document) => [
      document._id.toString(),
      { title: document.title, type: document.type },
    ])
  );

  const citations = hits
    .map((hit) => {
      const document = documentMap.get(hit.metadata.documentId);
      if (!document) return null;

      return {
        documentId: hit.metadata.documentId,
        title: document.title,
        type: document.type,
        chunkIndex: hit.metadata.chunkIndex,
        score: Math.round(hit.score * 100) / 100,
        text: hit.text,
      };
    })
    .filter((citation): citation is MemoryCitation => Boolean(citation));

  if (citations.length === 0) {
    return {
      success: true,
      query: question,
      answer:
        "I could not find any indexed memories that answer this yet. Upload or reindex relevant documents, then ask again.",
      citations: [],
      model: embedding.model,
    };
  }

  const geminiAnswer = await generateGeminiAnswer(question, citations);

  return {
    success: true,
    query: question,
    answer: geminiAnswer ?? buildExtractiveAnswer(question, citations),
    citations,
    model: geminiAnswer
      ? process.env.GEMINI_LLM_MODEL || "gemini-2.5-flash"
      : `${embedding.model}+extractive-rag`,
  };
}
