import type { TopicChunk, TopicChunkingOptions } from "../../types/chunking";
import { calculateTokens } from "../../utils/tokenCounter";
import {
  parseDocumentStructure,
  flattenSections,
} from "./structureParser";
import { splitByTokenLimit, buildContentPreview } from "./chunkSplitter";

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

function resolveLevel(path: string[], documentTitle: string): TopicChunk["level"] {
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

  // Prefix title for better embedding context (Notion/ChatGPT Memory pattern)
  if (body.toLowerCase().startsWith(title.toLowerCase())) {
    return body;
  }

  return `${title}\n\n${body}`;
}

/**
 * Create topic-aware semantic chunks from extracted document text.
 * Preserves section boundaries; splits only when a topic exceeds token limits.
 */
export function chunkTextByTopics(
  text: string,
  options: TopicChunkingOptions = {}
): TopicChunk[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const minTokens = options.minTokens ?? DEFAULT_MIN_TOKENS;
  const documentTitle = options.documentTitle ?? "Document";

  const root = parseDocumentStructure(trimmed, documentTitle);
  const flatSections = flattenSections(root);

  const chunks: TopicChunk[] = [];
  let chunkIndex = 0;
  const indexByPath = new Map<string, number>();

  const sectionsToProcess =
    flatSections.length > 0
      ? flatSections
      : [{ section: { ...root, content: trimmed }, path: [documentTitle] }];

  for (const { section, path } of sectionsToProcess) {
    const content = section.content.trim();
    if (!content) continue;

    const title = section.title || path[path.length - 1] || documentTitle;
    const { topic, subtopic } = normalizeTopicPath(path, documentTitle);
    const sectionPath = path.length > 0 ? path : [documentTitle];
    const level = resolveLevel(sectionPath, documentTitle);

    const parentPath = sectionPath.slice(0, -1).join("/");
    const parentChunkIndex = parentPath
      ? indexByPath.get(parentPath)
      : undefined;

    const textParts = splitByTokenLimit(
      buildChunkText(title, content),
      maxTokens
    );

    for (let partIndex = 0; partIndex < textParts.length; partIndex += 1) {
      const partText = textParts[partIndex];
      const tokens = calculateTokens(partText);

      if (tokens < minTokens && textParts.length === 1) continue;

      const partTitle =
        textParts.length > 1 ? `${title} (part ${partIndex + 1})` : title;

      const chunk: TopicChunk = {
        chunkIndex,
        text: partText,
        title: partTitle,
        topic,
        subtopic,
        sectionPath,
        level,
        parentChunkIndex,
        tokenCount: tokens,
        contentPreview: buildContentPreview(partText),
      };

      chunks.push(chunk);
      indexByPath.set(sectionPath.join("/"), chunkIndex);
      chunkIndex += 1;
    }
  }

  // Fallback: no structure detected — single semantic chunk
  if (chunks.length === 0 && trimmed) {
    const parts = splitByTokenLimit(trimmed, maxTokens);
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
      });
    }
  }

  return chunks;
}

/** Backward-compatible export — delegates to topic chunking */
export function chunkText(
  text: string,
  documentTitle?: string
): Array<{ chunkIndex: number; text: string }> {
  return chunkTextByTopics(text, { documentTitle }).map(
    ({ chunkIndex, text: chunkTextValue }) => ({
      chunkIndex,
      text: chunkTextValue,
    })
  );
}

export { DEFAULT_MAX_TOKENS, DEFAULT_MIN_TOKENS };
