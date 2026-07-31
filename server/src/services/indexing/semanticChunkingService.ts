import { env } from "../../config/env";
import type {
  DocumentStructureElement,
  PageContent,
  SemanticChunk,
} from "../../types/documentIntelligence";
import { calculateTokens } from "../../utils/tokenCounter";
import {
  splitByTokenLimit,
  buildContentPreview,
} from "../chunking/chunkSplitter";
import { flattenStructureElements } from "./documentStructureService";
import { resolvePageForLine, resolvePageRange } from "./pageExtractionService";

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_MIN_TOKENS = 5;

function normalizeTopicPath(
  path: string[],
  documentTitle: string
): { topic: string; subtopic?: string } {
  const normalized =
    path[0]?.toLowerCase() === documentTitle.toLowerCase()
      ? path.slice(1)
      : path;

  const topic = normalized[0] ?? documentTitle;
  const subtopic =
    normalized.length > 1 ? normalized[normalized.length - 1] : undefined;

  return { topic, subtopic };
}

function resolveLevel(
  path: string[],
  documentTitle: string
): SemanticChunk["level"] {
  const normalized =
    path[0]?.toLowerCase() === documentTitle.toLowerCase()
      ? path.slice(1)
      : path;

  if (normalized.length <= 1) return "topic";
  if (normalized.length === 2) return "subtopic";
  return "semantic";
}

function buildChunkText(title: string, content: string): string {
  const body = content.trim();
  if (!body) return title.trim();

  if (body.toLowerCase().startsWith(title.toLowerCase())) {
    return body;
  }

  return `${title}\n\n${body}`;
}

function buildSectionPath(element: DocumentStructureElement): string[] {
  const path: string[] = [];
  if (element.chapter) path.push(element.chapter);
  if (element.section && element.section !== element.chapter) {
    path.push(element.section);
  }
  if (
    element.heading &&
    element.heading !== element.section &&
    element.heading !== element.chapter
  ) {
    path.push(element.heading);
  }
  if (path.length === 0 && element.title) {
    path.push(element.title);
  }
  return path;
}

function splitSectionIntoPageParts(
  section: DocumentStructureElement,
  pages: PageContent[]
): Array<{
  text: string;
  pageNumber?: number;
  pageRange?: { start: number; end: number };
  pageOffset?: number;
}> {
  const content = section.content.trim();
  if (!content) return [];

  const sectionRange =
    section.pageRange ?? resolvePageRange(pages, section.lineStart, section.lineEnd);

  if (
    pages.length === 0 ||
    !sectionRange ||
    sectionRange.start === sectionRange.end
  ) {
    const pageInfo = resolvePageForLine(pages, section.lineStart);
    const pageNumber = section.pageNumber ?? pageInfo?.pageNumber;
    return [
      {
        text: content,
        pageNumber,
        pageRange: pageNumber ? { start: pageNumber, end: pageNumber } : sectionRange,
        pageOffset: pageInfo?.pageOffset,
      },
    ];
  }

  const contentLines = content.split(/\r?\n/);
  const parts: Array<{
    text: string;
    pageNumber?: number;
    pageRange?: { start: number; end: number };
    pageOffset?: number;
  }> = [];

  for (const page of pages) {
    const overlapStart = Math.max(section.lineStart, page.lineStart);
    const overlapEnd = Math.min(section.lineEnd, page.lineEnd);

    if (overlapStart > overlapEnd) continue;

    const relativeStart = Math.max(0, overlapStart - section.lineStart);
    const relativeEnd = Math.min(
      contentLines.length - 1,
      overlapEnd - section.lineStart
    );
    const pageText = contentLines
      .slice(relativeStart, relativeEnd + 1)
      .join("\n")
      .trim();

    if (!pageText) continue;

    parts.push({
      text: pageText,
      pageNumber: page.pageNumber,
      pageRange: { start: page.pageNumber, end: page.pageNumber },
      pageOffset: overlapStart - page.lineStart,
    });
  }

  return parts.length > 0
    ? parts
    : [
        {
          text: content,
          pageNumber: sectionRange.start,
          pageRange: { start: sectionRange.start, end: sectionRange.start },
        },
      ];
}

/**
 * Create semantic chunks preferring heading/section/topic boundaries.
 * Only splits by token limit when a section exceeds maxTokens.
 */
export function createSemanticChunks(
  structure: DocumentStructureElement,
  pages: PageContent[] = [],
  options: {
    documentTitle?: string;
    maxTokens?: number;
    minTokens?: number;
  } = {}
): SemanticChunk[] {
  const documentTitle = options.documentTitle ?? structure.title ?? "Document";
  const maxTokens = options.maxTokens ?? env.CHUNK_MAX_TOKENS ?? DEFAULT_MAX_TOKENS;
  const minTokens = options.minTokens ?? DEFAULT_MIN_TOKENS;

  const sections = flattenStructureElements(structure);
  const chunks: SemanticChunk[] = [];
  let chunkIndex = 0;
  const indexByPath = new Map<string, number>();

  const sectionsToProcess =
    sections.length > 0
      ? sections
      : [
          {
            ...structure,
            content: structure.content.trim(),
            title: documentTitle,
          },
        ];

  for (const section of sectionsToProcess) {
    const content = section.content.trim();
    if (!content) continue;

    const title = section.title || section.heading || documentTitle;
    const sectionPath = buildSectionPath(section);
    const { topic, subtopic } = normalizeTopicPath(sectionPath, documentTitle);
    const level = resolveLevel(sectionPath, documentTitle);

    const parentPath = sectionPath.slice(0, -1).join("/");
    const parentChunkIndex = parentPath
      ? indexByPath.get(parentPath)
      : undefined;

    const pageParts = splitSectionIntoPageParts(section, pages);

    for (const pagePart of pageParts) {
      const textParts = splitByTokenLimit(
        buildChunkText(title, pagePart.text),
        maxTokens
      );

      for (let partIndex = 0; partIndex < textParts.length; partIndex += 1) {
        const partText = textParts[partIndex];
        const tokens = calculateTokens(partText);

        if (tokens < minTokens && textParts.length === 1) continue;

        const partTitle =
          textParts.length > 1 ? `${title} (part ${partIndex + 1})` : title;

        const chunk: SemanticChunk = {
          chunkIndex,
          text: partText,
          title: partTitle,
          topic,
          subtopic,
          sectionPath: sectionPath.length > 0 ? sectionPath : [documentTitle],
          level,
          parentChunkIndex,
          tokenCount: tokens,
          contentPreview: buildContentPreview(partText),
          chapter: section.chapter,
          section: section.section,
          heading: section.heading ?? title,
          parentHeading: section.parentHeading,
          pageNumber: pagePart.pageNumber,
          pageRange: pagePart.pageRange,
          pageOffset: pagePart.pageOffset,
          sourcePage: pagePart.pageNumber,
          elementType: section.type,
        };

        chunks.push(chunk);
        if (!indexByPath.has(sectionPath.join("/"))) {
          indexByPath.set(sectionPath.join("/"), chunkIndex);
        }
        chunkIndex += 1;
      }
    }
  }

  if (chunks.length === 0 && structure.content.trim()) {
    const parts = splitByTokenLimit(structure.content.trim(), maxTokens);
    for (const part of parts) {
      chunks.push({
        chunkIndex: chunks.length,
        text: part,
        title: documentTitle,
        topic: documentTitle,
        sectionPath: [documentTitle],
        level: "semantic",
        tokenCount: calculateTokens(part),
        contentPreview: buildContentPreview(part),
        chapter: documentTitle,
        pageNumber: pages[0]?.pageNumber,
        sourcePage: pages[0]?.pageNumber,
      });
    }
  }

  return chunks;
}
