import type { VectorSearchResult, VectorMetadata } from "../types/embedding";
import type { RankedDocumentGroup, RankedChunkHit } from "../types/search";
import type { FusedSearchHit } from "./search/hybridSearchService";
import { env } from "../config/env";

/** Weights for composite chunk-level ranking */
const WEIGHTS = {
  rrf: 0.4,
  vector: 0.18,
  keyword: 0.15,
  topic: 0.08,
  title: 0.04,
  documentTitle: 0.05,
  metadata: 0.05,
  phrase: 0.05,
  graph: 0.1,
} as const;

const MAX_CHUNK_BONUS = 5;
const DUPLICATE_SIGNATURE_TERMS = 40;

export interface DocumentMetaForRanking {
  title: string;
  type: string;
  createdAt: Date;
  originalFileName?: string;
  storedFileName?: string;
  filePath?: string;
  mimeType?: string;
}

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

function normalizeForPrecision(text: string | undefined): string {
  return (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^\w\s+#.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPrecisionTerms(
  normalizedQuery: string,
  keywords?: string[],
  entities?: string[]
): string[] {
  const terms = new Set<string>();

  for (const keyword of keywords ?? []) {
    const normalized = normalizeForPrecision(keyword);
    if (normalized.length >= 2) terms.add(normalized);
  }

  for (const entity of entities ?? []) {
    for (const token of tokenizeQuery(entity)) {
      terms.add(token);
    }
  }

  if (terms.size === 0) {
    for (const token of tokenizeQuery(normalizedQuery)) {
      terms.add(token);
    }
  }

  return [...terms].slice(0, 12);
}

function computeTermOverlap(text: string | undefined, terms: string[]): number {
  if (terms.length === 0) return 0;

  const normalized = normalizeForPrecision(text);
  if (!normalized) return 0;

  let matches = 0;
  for (const term of terms) {
    if (normalized.includes(term)) {
      matches += 1;
    }
  }

  return matches / terms.length;
}

function hasExactPhraseMatch(
  text: string | undefined,
  normalizedQuery: string,
  terms: string[]
): boolean {
  const normalizedText = normalizeForPrecision(text);
  if (!normalizedText) return false;

  const normalizedPhrase = normalizeForPrecision(normalizedQuery);
  const keywordPhrase = terms.join(" ");

  return (
    (normalizedPhrase.length >= 6 && normalizedText.includes(normalizedPhrase)) ||
    (keywordPhrase.length >= 6 && normalizedText.includes(keywordPhrase))
  );
}

function buildMetadataText(hit: RankedChunkHit, documentTitle?: string): string {
  return [
    documentTitle,
    hit.metadata.documentName as string | undefined,
    hit.title,
    hit.topic,
    hit.subtopic,
    hit.summary,
    ...(hit.sectionPath ?? []),
    ...(hit.keywords ?? []),
    ...(hit.tags ?? []),
    hit.metadata.chapter as string | undefined,
    hit.metadata.section as string | undefined,
    hit.metadata.heading as string | undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildHeadingText(hit: RankedChunkHit): string {
  return [
    hit.title,
    hit.topic,
    hit.subtopic,
    ...(hit.sectionPath ?? []),
    hit.metadata.heading as string | undefined,
    hit.metadata.section as string | undefined,
    hit.metadata.chapter as string | undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenizeQuery(normalizeForPrecision(text).replace(/[-.]/g, " ")));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  return intersection / (a.size + b.size - intersection);
}

function duplicateSignature(hit: RankedChunkHit): Set<string> {
  return tokenSet(
    [
      hit.metadata.documentId,
      hit.metadata.pageNumber,
      hit.title,
      hit.topic,
      hit.text.split(/\s+/).slice(0, DUPLICATE_SIGNATURE_TERMS).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function buildMatchReasons(hit: RankedChunkHit): string[] {
  const reasons: string[] = [];

  if (
    hit.vectorScore >= env.PRECISION_STRONG_VECTOR_SCORE ||
    (hit.crossEncoderScore ?? 0) >= env.PRECISION_STRONG_VECTOR_SCORE
  ) {
    reasons.push("High semantic similarity");
  }

  if (hit.documentTitleScore >= 0.5) {
    reasons.push("Document title matched the query");
  }

  if (hit.titleScore > 0 || hit.topicScore > 0) {
    reasons.push("Heading or topic matched the query");
  }

  if (hit.keywordScore > 0 || hit.matchedKeywords.length > 0) {
    reasons.push("Contains matching keywords");
  }

  if (hit.metadataScore > 0) {
    reasons.push("Metadata matched the query");
  }

  if (hit.phraseScore > 0) {
    reasons.push("Contains an exact query phrase");
  }

  if ((hit.graphScore ?? 0) > 0) {
    reasons.push("Connected knowledge graph context matched");
  }

  return reasons.length > 0 ? reasons : ["Ranked as a relevant semantic match"];
}

export interface PrecisionFilterOptions {
  normalizedQuery: string;
  keywords?: string[];
  entities?: string[];
  documentMeta: Map<string, DocumentMetaForRanking>;
  minVectorScore?: number;
  strongVectorScore?: number;
  minKeywordOverlap?: number;
  minMetadataOverlap?: number;
  minTitleOverlap?: number;
  dedupeSimilarity?: number;
}

export function passesPrecisionGate(
  hit: RankedChunkHit,
  options: PrecisionFilterOptions
): boolean {
  const terms = buildPrecisionTerms(
    options.normalizedQuery,
    options.keywords,
    options.entities
  );
  const docMeta = options.documentMeta.get(hit.documentId);
  const documentTitle =
    docMeta?.title ?? (hit.metadata.documentTitle as string | undefined);
  const documentName =
    docMeta?.originalFileName ??
    (hit.metadata.documentName as string | undefined) ??
    documentTitle;

  const minVectorScore =
    options.minVectorScore ?? env.PRECISION_MIN_VECTOR_SCORE;
  const strongVectorScore =
    options.strongVectorScore ?? env.PRECISION_STRONG_VECTOR_SCORE;
  const minKeywordOverlap =
    options.minKeywordOverlap ?? env.PRECISION_MIN_KEYWORD_OVERLAP;
  const minMetadataOverlap =
    options.minMetadataOverlap ?? env.PRECISION_MIN_METADATA_OVERLAP;
  const minTitleOverlap =
    options.minTitleOverlap ?? env.PRECISION_MIN_TITLE_OVERLAP;

  const titleText = [documentTitle, documentName].filter(Boolean).join(" ");
  const metadataText = buildMetadataText(hit, documentTitle);
  const headingText = buildHeadingText(hit);
  const contentText = [hit.text, hit.contentPreview].filter(Boolean).join(" ");

  const titleOverlap = computeTermOverlap(titleText, terms);
  const metadataOverlap = computeTermOverlap(metadataText, terms);
  const headingOverlap = computeTermOverlap(headingText, terms);
  const keywordOverlap = computeTermOverlap(contentText, terms);

  const exactTitleMatch = hasExactPhraseMatch(
    titleText,
    options.normalizedQuery,
    terms
  );
  const exactContentMatch = hasExactPhraseMatch(
    contentText,
    options.normalizedQuery,
    terms
  );

  const titleStrong = exactTitleMatch || titleOverlap >= minTitleOverlap;
  const metadataStrong =
    metadataOverlap >= minMetadataOverlap || headingOverlap >= minMetadataOverlap;
  const keywordStrong = keywordOverlap >= minKeywordOverlap || exactContentMatch;
  const semanticStrong =
    hit.vectorScore >= strongVectorScore ||
    (hit.crossEncoderScore ?? 0) >= strongVectorScore;
  const semanticSupported =
    hit.vectorScore >= minVectorScore &&
    (titleOverlap > 0 ||
      metadataOverlap > 0 ||
      headingOverlap > 0 ||
      keywordOverlap > 0 ||
      hit.keywordScore > 0);

  return titleStrong || metadataStrong || keywordStrong || semanticStrong || semanticSupported;
}

export function applyPrecisionFilters(
  chunks: RankedChunkHit[],
  options: PrecisionFilterOptions
): RankedChunkHit[] {
  if (!env.ENABLE_PRECISION_FILTER || chunks.length === 0) {
    return chunks;
  }

  const dedupeSimilarity =
    options.dedupeSimilarity ?? env.PRECISION_DEDUPE_SIMILARITY;
  const accepted: RankedChunkHit[] = [];
  const signaturesByLocation = new Map<string, Set<string>[]>();

  for (const chunk of chunks) {
    if (!passesPrecisionGate(chunk, options)) continue;

    const locationKey = [
      chunk.documentId,
      chunk.pageNumber ?? chunk.metadata.pageNumber ?? "unknown",
      chunk.title ?? chunk.topic ?? "chunk",
    ].join(":");
    const signature = duplicateSignature(chunk);
    const existingSignatures = signaturesByLocation.get(locationKey) ?? [];
    const duplicate = existingSignatures.some(
      (existing) => jaccardSimilarity(existing, signature) >= dedupeSimilarity
    );

    if (duplicate) continue;

    existingSignatures.push(signature);
    signaturesByLocation.set(locationKey, existingSignatures);
    accepted.push(chunk);
  }

  return accepted;
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

export function extractMatchedKeywords(
  hit: FusedSearchHit,
  documentTitle: string | undefined,
  queryTerms: string[]
): string[] {
  if (queryTerms.length === 0) return [];

  const matched = new Set<string>();

  const fields = [
    hit.text,
    hit.title,
    hit.topic,
    hit.subtopic,
    hit.summary,
    documentTitle,
    ...(hit.keywords ?? []),
    ...(hit.tags ?? []),
    ...(hit.sectionPath ?? []),
  ].filter(Boolean);

  const haystack = fields.join(" ").toLowerCase();

  for (const term of queryTerms) {
    if (haystack.includes(term)) {
      matched.add(term);
    }
  }

  return [...matched];
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

export function computeDocumentTitleScore(
  documentTitle: string | undefined,
  queryTerms: string[]
): number {
  if (!documentTitle || queryTerms.length === 0) return 0;
  return computeKeywordScore(documentTitle, queryTerms);
}

export function computeMetadataScore(
  hit: FusedSearchHit,
  queryTerms: string[]
): number {
  if (queryTerms.length === 0) return 0;

  const metadataText = [
    ...(hit.tags ?? []),
    ...(hit.keywords ?? []),
    hit.summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return computeKeywordScore(metadataText, queryTerms);
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

/** Normalize raw final scores to 0–1 confidence within a result set */
export function normalizeConfidenceScores(
  chunks: RankedChunkHit[]
): RankedChunkHit[] {
  if (chunks.length === 0) return chunks;

  const max = Math.max(...chunks.map((c) => c.finalScore));
  const min = Math.min(...chunks.map((c) => c.finalScore));
  const range = max - min;

  if (range === 0) {
    return chunks.map((c) => ({ ...c, confidenceScore: 1 }));
  }

  return chunks.map((c) => ({
    ...c,
    confidenceScore: Math.round(((c.finalScore - min) / range) * 1000) / 1000,
  }));
}

function scoreChunkHit(
  hit: FusedSearchHit,
  query: string,
  documentMeta: Map<string, DocumentMetaForRanking>,
  rankingQuery?: string
): RankedChunkHit {
  const documentId = hit.metadata.documentId;
  const docMeta = documentMeta.get(documentId);
  const effectiveQuery = rankingQuery ?? query;
  const queryTerms = tokenizeQuery(effectiveQuery);
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
  const documentTitleScore = computeDocumentTitleScore(
    docMeta?.title ?? (hit.metadata.documentTitle as string | undefined),
    queryTerms
  );
  const metadataScore = computeMetadataScore(hit, queryTerms);
  const phraseScore = computePhraseBoost(hit, phrases);
  const matchedKeywords = extractMatchedKeywords(
    hit,
    docMeta?.title,
    queryTerms
  );

  const finalScore =
    hit.rrfScore * WEIGHTS.rrf +
    hit.vectorScore * WEIGHTS.vector +
    keywordScore * WEIGHTS.keyword +
    topicScore * WEIGHTS.topic +
    titleScore * WEIGHTS.title +
    documentTitleScore * WEIGHTS.documentTitle +
    metadataScore * WEIGHTS.metadata +
    phraseScore * WEIGHTS.phrase +
    (hit.graphScore ?? 0) * WEIGHTS.graph;

  const documentTitle =
    docMeta?.title ?? (hit.metadata.documentTitle as string | undefined);

  const metadata: VectorMetadata = {
    ...hit.metadata,
    documentId,
    documentTitle,
    topic: hit.topic ?? hit.metadata.topic,
    subtopic: hit.subtopic,
    title: hit.title,
    summary: hit.summary,
    keywords: hit.keywords,
    tags: hit.tags,
    sectionPath: hit.sectionPath,
    contentPreview: hit.contentPreview,
  };

  return {
    vectorId: hit.vectorId,
    documentId,
    chunkIndex: hit.metadata.chunkIndex,
    text: hit.text,
    topic: hit.topic,
    subtopic: hit.subtopic,
    title: hit.title,
    summary: hit.summary,
    keywords: hit.keywords,
    tags: hit.tags,
    sectionPath: hit.sectionPath,
    contentPreview: hit.contentPreview ?? hit.text.slice(0, 200),
    metadata,
    vectorScore: hit.vectorScore,
    keywordScore,
    topicScore,
    titleScore,
    documentTitleScore,
    metadataScore,
    phraseScore,
    rrfScore: hit.rrfScore,
    finalScore,
    confidenceScore: 0,
    graphScore: hit.graphScore,
    graphConfidence: hit.graphConfidence,
    graphMatchedNodes: hit.graphMatchedNodes,
    matchedKeywords,
    matchReasons: [],
    pageNumber: hit.metadata.pageNumber as number | undefined,
    timestampFormatted: hit.metadata.timestampFormatted as string | undefined,
    timestampSeconds: hit.metadata.timestampSeconds as number | undefined,
    videoUrl: hit.metadata.videoUrl as string | undefined,
    youtubeVideoId: hit.metadata.youtubeVideoId as string | undefined,
    channel: hit.metadata.channel as string | undefined,
  };
}

/**
 * Rank fused chunk hits by composite score (shared by search and RAG).
 */
export function rankRankedChunks(
  fusedHits: FusedSearchHit[],
  documentMeta: Map<string, DocumentMetaForRanking>,
  query: string,
  rankingQuery?: string
): RankedChunkHit[] {
  const scored = fusedHits
    .map((hit) => scoreChunkHit(hit, query, documentMeta, rankingQuery))
    .sort((a, b) => b.finalScore - a.finalScore);

  return normalizeConfidenceScores(scored);
}

/**
 * Rank fused chunk hits, then group by document for UI display.
 */
export function rankDocumentGroups(
  fusedHits: FusedSearchHit[],
  documentMeta: Map<string, DocumentMetaForRanking>,
  query: string,
  rankingQuery?: string
): RankedDocumentGroup[] {
  const scoredChunks = rankRankedChunks(
    fusedHits,
    documentMeta,
    query,
    rankingQuery
  );
  return groupRankedChunksIntoDocuments(scoredChunks, documentMeta);
}

/** Collapse duplicate chunk hits by vectorId (first / highest-ranked wins). */
export function dedupeRankedChunksById(
  chunks: RankedChunkHit[]
): RankedChunkHit[] {
  const seen = new Set<string>();
  const unique: RankedChunkHit[] = [];

  for (const chunk of chunks) {
    const key = chunk.vectorId || `${chunk.documentId}:${chunk.chunkIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(chunk);
  }

  return unique;
}

/** Unique ascending page numbers from matched chunks (skips missing pages). */
export function collectMatchingPages(
  chunks: Array<{ pageNumber?: number }>
): number[] {
  const pages = new Set<number>();

  for (const chunk of chunks) {
    if (
      typeof chunk.pageNumber === "number" &&
      Number.isFinite(chunk.pageNumber) &&
      chunk.pageNumber >= 1
    ) {
      pages.add(chunk.pageNumber);
    }
  }

  return [...pages].sort((a, b) => a - b);
}

export function roundSearchScore(score: number): number {
  return Math.round(score * 100) / 100;
}

/**
 * Group already-ranked chunks by document (for search UI after RetrievalCore).
 */
export function groupRankedChunksIntoDocuments(
  scoredChunks: RankedChunkHit[],
  documentMeta: Map<string, DocumentMetaForRanking>
): RankedDocumentGroup[] {
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
    const meta = documentMeta.get(chunk.documentId);
    if (!meta) continue;

    const existing = grouped.get(chunk.documentId);
    if (existing) {
      existing.chunks.push(chunk);
    } else {
      grouped.set(chunk.documentId, {
        documentId: chunk.documentId,
        title: meta.title,
        type: meta.type,
        createdAt: meta.createdAt,
        chunks: [chunk],
      });
    }
  }

  const ranked: RankedDocumentGroup[] = [];

  for (const group of grouped.values()) {
    const meta = documentMeta.get(group.documentId);
    const chunks = dedupeRankedChunksById(group.chunks);
    const top = chunks[0];
    const chunkBonus =
      Math.min(chunks.length, MAX_CHUNK_BONUS) / MAX_CHUNK_BONUS;
    const recencyScore = computeRecencyScore(group.createdAt);

    ranked.push({
      documentId: group.documentId,
      title: group.title,
      type: group.type as RankedDocumentGroup["type"],
      createdAt: group.createdAt,
      matchedChunks: chunks.map((c) => ({
        chunkId: c.vectorId,
        chunkIndex: c.chunkIndex,
        score: c.finalScore,
        similarityScore: c.vectorScore,
        text: c.text,
        chunkText: c.text,
        preview: c.contentPreview,
        pageNumber: c.pageNumber,
        sectionHeading:
          (c.metadata.heading as string | undefined) ??
          c.title,
        chapter: c.metadata.chapter as string | undefined,
        topic: c.topic,
        subtopic: c.subtopic,
        title: c.title,
        sectionPath: c.sectionPath,
        matchedKeywords: c.matchedKeywords,
        matchReasons: c.matchReasons?.length
          ? c.matchReasons
          : buildMatchReasons(c),
        timestamp: c.timestampFormatted,
        timestampSeconds: c.timestampSeconds,
        videoUrl: c.videoUrl,
      })),
      vectorScore: top?.vectorScore ?? 0,
      keywordScore: top?.keywordScore ?? 0,
      topicScore: top?.topicScore ?? 0,
      chunkCount: chunks.length,
      finalScore:
        (top?.finalScore ?? 0) + chunkBonus * 0.02 + recencyScore * 0.02,
      bestChunkText: top?.contentPreview ?? top?.text ?? "",
      pageNumber: top?.pageNumber,
      fileUrl: chunks[0]?.metadata.fileUrl as string | undefined,
      chunkId: top?.vectorId,
      documentName: chunks[0]?.metadata.documentName as string | undefined,
      originalFileName: meta?.originalFileName,
      filePath: meta?.filePath,
      mimeType: meta?.mimeType,
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
  documentMeta: Map<string, DocumentMetaForRanking>,
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
