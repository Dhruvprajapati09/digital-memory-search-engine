import DocumentModel from "../models/Document";
import { AppError } from "../middleware/error.middleware";
import { tokenizeQuery } from "./rankingService";

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "because",
  "been",
  "being",
  "between",
  "from",
  "have",
  "into",
  "more",
  "other",
  "over",
  "such",
  "than",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "when",
  "where",
  "which",
  "with",
  "your",
]);

export interface Flashcard {
  question: string;
  answer: string;
}

export interface QuizQuestion {
  question: string;
  answer: string;
  options: string[];
}

export interface DocumentInsights {
  success: boolean;
  summary: string;
  keyPoints: string[];
  tags: string[];
  actionItems: string[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
}

function topTerms(text: string, limit: number): string[] {
  const counts = new Map<string, number>();

  for (const token of tokenizeQuery(text)) {
    if (token.length < 4 || STOP_WORDS.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function buildSummary(allSentences: string[]): string {
  return allSentences.slice(0, 4).join(" ") || "No summary available yet.";
}

function buildKeyPoints(allSentences: string[], terms: string[]): string[] {
  return allSentences
    .map((sentence) => ({
      sentence,
      score: terms.filter((term) => sentence.toLowerCase().includes(term))
        .length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.sentence);
}

function buildActionItems(allSentences: string[]): string[] {
  const actionPattern =
    /\b(todo|to do|deadline|due|remember|follow up|submit|complete|finish|review|schedule|call|email|prepare|must|should|need to)\b/i;

  return allSentences
    .filter((sentence) => actionPattern.test(sentence))
    .slice(0, 8);
}

function buildFlashcards(allSentences: string[], tags: string[]): Flashcard[] {
  const cards: Flashcard[] = [];

  for (const tag of tags) {
    const sentence = allSentences.find((item) =>
      item.toLowerCase().includes(tag)
    );

    if (!sentence) continue;

    cards.push({
      question: `What does this memory say about ${tag}?`,
      answer: sentence,
    });

    if (cards.length >= 6) break;
  }

  return cards;
}

function buildQuiz(flashcards: Flashcard[], tags: string[]): QuizQuestion[] {
  return flashcards.slice(0, 5).map((card, index) => {
    const answer = tags[index] ?? "the source memory";
    const distractors = tags
      .filter((tag) => tag !== answer)
      .slice(0, 3);

    return {
      question: card.question,
      answer,
      options: [answer, ...distractors].slice(0, 4),
    };
  });
}

export async function getDocumentInsights(
  userId: string,
  documentId: string
): Promise<DocumentInsights> {
  const document = await DocumentModel.findOne({ _id: documentId, userId });

  if (!document) {
    throw new AppError("Document not found", 404);
  }

  const text = document.extractedText?.trim();

  if (!text) {
    throw new AppError("Document has no extracted text yet", 400);
  }

  const allSentences = sentences(text);
  const tags = topTerms(text, 10);
  const flashcards = buildFlashcards(allSentences, tags);

  return {
    success: true,
    summary: buildSummary(allSentences),
    keyPoints: buildKeyPoints(allSentences, tags),
    tags,
    actionItems: buildActionItems(allSentences),
    flashcards,
    quiz: buildQuiz(flashcards, tags),
  };
}
