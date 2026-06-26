import type { VectorSearchResult } from "../types/embedding";
import type { RankedDocumentGroup, RankedChunkHit } from "../types/search";
import type { FusedSearchHit } from "./search/hybridSearchService";

/** Weights for composite chunk-level ranking */
const WEIGHTS = {
  rrf: 0.45,
  vector: 0.2,
  keyword: 0.15,
  topic: 0.1,
  title: 0.05,
  phrase: 0.05,
} as const;

const MAX_CHUNK_BONUS = 5;

export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^\w-]/g, ""))
    .filter((term) => term.length >= 2);
}

export function extractPhrases(query: string): string[] {
  const phrases: string[] = [];
  const quoted = query.match(/"([^"]+)"/g);
  if (quoted) {
    for (const q of quoted) {
      phrases.push(q.replace(/"/g, "").trim().toLowerCase());
    }
  }

  const normalized = query.trim().toLowerCase();
  if (normalized.length >= 4 && !phrases.includes(normalized)) {
    phrases.push(normalized);
  }

  return phrases.filter(Boolean);
}

export function computeKeywordScore(text: string, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;

  const lowerText = text.toLowerCase();
  let matches = 0;

  for (const term of queryTerms) {
    if (lowerText.includes(term)) {
      matches += 1;
    }
  }

  return matches / queryTerms.length;
}

export function computeTopicScore(
  hit: FusedSearchHit,
  queryTerms: string[]
): number {
  if (queryTerms.length === 0) return 0;

  const topicText = [
    hit.topic,
    hit.subtopic,
    ...(hit.sectionPath ?? []),
    ...(hit.tags ?? []),
    ...(hit.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return computeKeywordScore(topicText, queryTerms);
}

export function computeTitleScore(
  hit: FusedSearchHit,
  queryTerms: string[]
): number {
  if (!hit.title || queryTerms.length === 0) return 0;
  return computeKeywordScore(hit.title, queryTerms);
}

export function computePhraseBoost(
  hit: FusedSearchHit,
  phrases: string[]
): number {
  if (phrases.length === 0) return 0;

  const haystack = [
    hit.text,
    hit.title,
    hit.topic,
    hit.subtopic,
    hit.summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let matches = 0;
  for (const phrase of phrases) {
    if (haystack.includes(phrase)) matches += 1;
  }

  return matches / phrases.length;
}

export function computeRecencyScore(createdAt: Date, now = new Date()): number {
  const ageMs = now.getTime() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - ageDays / 90);
}

function scoreChunkHit(
  hit: FusedSearchHit,
  query: string
): RankedChunkHit {
  const queryTerms = tokenizeQuery(query);
  const phrases = extractPhrases(query);
  const searchable = [
    hit.text,
    hit.title,
    hit.summary,
    hit.topic,
    hit.subtopic,
  ]
    .filter(Boolean)
    .join(" ");

  const keywordScore = computeKeywordScore(searchable, queryTerms);
  const topicScore = computeTopicScore(hit, queryTerms);
  const titleScore = computeTitleScore(hit, queryTerms);
  const phraseScore = computePhraseBoost(hit, phrases);

  const finalScore =
    hit.rrfScore * WEIGHTS.rrf +
    hit.vectorScore * WEIGHTS.vector +
    keywordScore * WEIGHTS.keyword +
    topicScore * WEIGHTS.topic +
    titleScore * WEIGHTS.title +
    phraseScore * WEIGHTS.phrase;

  return {
    vectorId: hit.vectorId,
    chunkIndex: hit.metadata.chunkIndex,
    text: hit.text,
    topic: hit.topic,
    subtopic: hit.subtopic,
    title: hit.title,
    sectionPath: hit.sectionPath,
    contentPreview: hit.contentPreview ?? hit.text.slice(0, 200),
    vectorScore: hit.vectorScore,
    keywordScore,
    topicScore,
    titleScore,
    phraseScore,
    rrfScore: hit.rrfScore,
    finalScore,
<<<<<<< HEAD
=======
    timestampFormatted: hit.metadata.timestampFormatted as string | undefined,
    timestampSeconds: hit.metadata.timestampSeconds as number | undefined,
    videoUrl: hit.metadata.videoUrl as string | undefined,
    youtubeVideoId: hit.metadata.youtubeVideoId as string | undefined,
    channel: hit.metadata.channel as string | undefined,
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
  };
}

/**
 * Rank fused chunk hits, then group by document for UI display.
 */
export function rankDocumentGroups(
  fusedHits: FusedSearchHit[],
  documentMeta: Map<
    string,
    { title: string; type: string; createdAt: Date }
  >,
  query: string
): RankedDocumentGroup[] {
  const scoredChunks = fusedHits
    .map((hit) => scoreChunkHit(hit, query))
    .sort((a, b) => b.finalScore - a.finalScore);

  const grouped = new Map<
    string,
    {
      documentId: string;
      title: string;
      type: string;
      createdAt: Date;
      chunks: RankedChunkHit[];
    }
  >();

  for (const chunk of scoredChunks) {
    const documentId = fusedHits.find(
      (h) => h.vectorId === chunk.vectorId
    )?.metadata.documentId;

    if (!documentId) continue;

    const meta = documentMeta.get(documentId);
    if (!meta) continue;

    const existing = grouped.get(documentId);
    if (existing) {
      existing.chunks.push(chunk);
    } else {
      grouped.set(documentId, {
        documentId,
        title: meta.title,
        type: meta.type,
        createdAt: meta.createdAt,
        chunks: [chunk],
      });
    }
  }

  const ranked: RankedDocumentGroup[] = [];

  for (const group of grouped.values()) {
    const top = group.chunks[0];
    const chunkBonus =
      Math.min(group.chunks.length, MAX_CHUNK_BONUS) / MAX_CHUNK_BONUS;
    const recencyScore = computeRecencyScore(group.createdAt);

    ranked.push({
      documentId: group.documentId,
      title: group.title,
      type: group.type as RankedDocumentGroup["type"],
      createdAt: group.createdAt,
      matchedChunks: group.chunks.map((c) => ({
        chunkIndex: c.chunkIndex,
        score: c.finalScore,
        text: c.text,
        topic: c.topic,
        subtopic: c.subtopic,
        title: c.title,
        sectionPath: c.sectionPath,
<<<<<<< HEAD
=======
        timestamp: c.timestampFormatted,
        timestampSeconds: c.timestampSeconds,
        videoUrl: c.videoUrl,
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
      })),
      vectorScore: top?.vectorScore ?? 0,
      keywordScore: top?.keywordScore ?? 0,
      topicScore: top?.topicScore ?? 0,
      chunkCount: group.chunks.length,
      finalScore: (top?.finalScore ?? 0) + chunkBonus * 0.02 + recencyScore * 0.02,
      bestChunkText: top?.contentPreview ?? top?.text ?? "",
      topTopic: top?.topic,
      topSubtopic: top?.subtopic,
    });
  }

  return ranked.sort((a, b) => b.finalScore - a.finalScore);
}

/** Generate preview centered on query terms, preferring contentPreview */
export function generatePreviewSnippet(
  text: string,
  query: string,
  minLength = 200,
  maxLength = 300
): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const queryTerms = tokenizeQuery(query);
  const lowerText = normalized.toLowerCase();

  let anchorIndex = 0;

  for (const term of queryTerms) {
    const idx = lowerText.indexOf(term);
    if (idx >= 0) {
      anchorIndex = idx;
      break;
    }
  }

  const halfWindow = Math.floor(maxLength / 2);
  let start = Math.max(0, anchorIndex - halfWindow);
  let end = Math.min(normalized.length, start + maxLength);

  if (end - start < minLength) {
    start = Math.max(0, end - minLength);
  }

  let snippet = normalized.slice(start, end).trim();

  if (start > 0) snippet = `...${snippet}`;
  if (end < normalized.length) snippet = `${snippet}...`;

  return snippet;
}

/** @deprecated Use rankDocumentGroups with fused hits — kept for tests */
export function rankLegacyVectorGroups(
  matches: VectorSearchResult[],
  documentMeta: Map<
    string,
    { title: string; type: string; createdAt: Date }
  >,
  query: string
): RankedDocumentGroup[] {
  const fused = matches.map((m) => ({
    vectorId: m.vectorId,
    text: m.text,
    metadata: m.metadata,
    vectorScore: m.score,
    keywordScore: 0,
    rrfScore: m.score,
    topic: m.topic,
    subtopic: m.subtopic,
    title: m.title,
    summary: m.summary,
    keywords: m.keywords,
    tags: m.tags,
    sectionPath: m.sectionPath,
    contentPreview: m.contentPreview,
  }));

  return rankDocumentGroups(fused, documentMeta, query);
}
