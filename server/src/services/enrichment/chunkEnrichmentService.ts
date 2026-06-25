import type { TopicChunk } from "../../types/chunking";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "must", "shall", "can",
  "this", "that", "these", "those", "it", "its", "they", "them", "their",
  "we", "our", "you", "your", "i", "my", "me", "about", "into", "through",
  "during", "before", "after", "above", "below", "between", "under",
  "again", "further", "then", "once", "here", "there", "when", "where",
  "why", "how", "all", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
  "very", "just", "also", "now", "what", "which", "who", "whom", "learn",
  "learned", "note", "notes",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function extractKeywords(text: string, max = 12): string[] {
  const freq = new Map<string, number>();

  for (const word of tokenize(text)) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([word]) => word);
}

function extractConcepts(chunk: TopicChunk): string[] {
  const concepts = new Set<string>();

  for (const segment of chunk.sectionPath) {
    concepts.add(segment);
  }

  if (chunk.subtopic) concepts.add(chunk.subtopic);
  if (chunk.topic) concepts.add(chunk.topic);

  // CamelCase / PascalCase identifiers (e.g. useMemo, useCallback)
  const identifiers = chunk.text.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) ?? [];
  for (const id of identifiers.slice(0, 8)) {
    concepts.add(id);
  }

  // Backtick code terms
  const codeTerms = chunk.text.match(/`([^`]+)`/g) ?? [];
  for (const term of codeTerms.slice(0, 6)) {
    concepts.add(term.replace(/`/g, "").trim());
  }

  return [...concepts].filter(Boolean);
}

function buildSummary(text: string, title: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sentences = normalized.match(/[^.!?]+[.!?]+/g) ?? [normalized];

  const first = sentences[0]?.trim() ?? normalized;
  const summary = first.length > 240 ? `${first.slice(0, 237).trim()}...` : first;

  if (summary.toLowerCase().includes(title.toLowerCase())) {
    return summary;
  }

  return `${title}: ${summary}`;
}

function buildTags(chunk: TopicChunk, keywords: string[]): string[] {
  const tags = new Set<string>();

  tags.add(chunk.topic.toLowerCase());
  if (chunk.subtopic) tags.add(chunk.subtopic.toLowerCase());
  if (chunk.level) tags.add(chunk.level);

  for (const kw of keywords.slice(0, 6)) {
    tags.add(kw);
  }

  return [...tags].slice(0, 15);
}

export interface EnrichedChunkMetadata {
  topic: string;
  subtopic?: string;
  title: string;
  summary: string;
  keywords: string[];
  concepts: string[];
  tags: string[];
  sectionPath: string[];
  contentPreview: string;
  level: TopicChunk["level"];
  parentChunkIndex?: number;
}

/**
 * Rule-based semantic enrichment (fast, no LLM cost).
 * Used at index time; optional LLM pass can refine later.
 */
export function enrichChunkMetadata(chunk: TopicChunk): EnrichedChunkMetadata {
  const keywords = extractKeywords(
    `${chunk.title} ${chunk.topic} ${chunk.subtopic ?? ""} ${chunk.text}`
  );
  const concepts = extractConcepts(chunk);
  const summary = buildSummary(chunk.text, chunk.title);
  const tags = buildTags(chunk, keywords);

  return {
    topic: chunk.topic,
    subtopic: chunk.subtopic,
    title: chunk.title,
    summary,
    keywords,
    concepts,
    tags,
    sectionPath: chunk.sectionPath,
    contentPreview: chunk.contentPreview,
    level: chunk.level,
    parentChunkIndex: chunk.parentChunkIndex,
  };
}

/** Text used for embedding — title + summary + content (RAG best practice) */
export function buildEmbeddingText(
  chunk: TopicChunk,
  enrichment: EnrichedChunkMetadata
): string {
  const parts = [
    `Topic: ${enrichment.topic}`,
    enrichment.subtopic ? `Subtopic: ${enrichment.subtopic}` : null,
    `Title: ${enrichment.title}`,
    `Summary: ${enrichment.summary}`,
    `Keywords: ${enrichment.keywords.join(", ")}`,
    chunk.text,
  ].filter(Boolean);

  return parts.join("\n");
}

/** Text indexed for keyword/BM25-style search */
export function buildSearchableText(
  chunk: TopicChunk,
  enrichment: EnrichedChunkMetadata
): string {
  return [
    enrichment.title,
    enrichment.topic,
    enrichment.subtopic ?? "",
    enrichment.summary,
    enrichment.keywords.join(" "),
    enrichment.concepts.join(" "),
    enrichment.tags.join(" "),
    enrichment.sectionPath.join(" "),
    chunk.text,
  ]
    .filter(Boolean)
    .join("\n");
}
