import type { RetrievedChunk } from "../../types/chat";

function resolvePageNumber(chunk: RetrievedChunk): number {
  const raw =
    chunk.metadata.pageNumber ?? chunk.metadata.page;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.floor(raw);
  }
  return Number.MAX_SAFE_INTEGER;
}

function resolveChapter(chunk: RetrievedChunk): string {
  const chapter = chunk.metadata.chapter as string | undefined;
  if (chapter) return chapter.toLowerCase();

  const path = chunk.sectionPath ?? [];
  return (path[0] ?? "").toLowerCase();
}

function resolveSection(chunk: RetrievedChunk): string {
  const section = chunk.metadata.section as string | undefined;
  if (section) return section.toLowerCase();

  const path = chunk.sectionPath ?? [];
  if (path.length >= 2) return path[1].toLowerCase();
  if (path.length === 1) return path[0].toLowerCase();
  return "";
}

function resolveTopic(chunk: RetrievedChunk): string {
  return (chunk.topic ?? chunk.metadata.topic ?? "").toLowerCase();
}

function resolveDocumentTitle(chunk: RetrievedChunk): string {
  return (chunk.metadata.documentTitle ?? "").toLowerCase();
}

/**
 * Sort chunks in logical reading order:
 * Document → Chapter → Page → Section → Topic → Chunk Index
 */
export function orderChunksLogically(
  chunks: RetrievedChunk[]
): RetrievedChunk[] {
  return [...chunks].sort((a, b) => {
    const docCmp = resolveDocumentTitle(a).localeCompare(
      resolveDocumentTitle(b)
    );
    if (docCmp !== 0) return docCmp;

    const chapterCmp = resolveChapter(a).localeCompare(resolveChapter(b));
    if (chapterCmp !== 0) return chapterCmp;

    const pageA = resolvePageNumber(a);
    const pageB = resolvePageNumber(b);
    if (pageA !== pageB) return pageA - pageB;

    const sectionCmp = resolveSection(a).localeCompare(resolveSection(b));
    if (sectionCmp !== 0) return sectionCmp;

    const topicCmp = resolveTopic(a).localeCompare(resolveTopic(b));
    if (topicCmp !== 0) return topicCmp;

    return a.metadata.chunkIndex - b.metadata.chunkIndex;
  });
}

/**
 * Group chunks by document for continuity-aware selection.
 */
export function groupChunksByDocument(
  chunks: RetrievedChunk[]
): Map<string, RetrievedChunk[]> {
  const groups = new Map<string, RetrievedChunk[]>();

  for (const chunk of chunks) {
    const docId = chunk.metadata.documentId;
    const list = groups.get(docId) ?? [];
    list.push(chunk);
    groups.set(docId, list);
  }

  for (const [docId, list] of groups) {
    groups.set(docId, orderChunksLogically(list));
  }

  return groups;
}

export {
  resolvePageNumber,
  resolveChapter,
  resolveSection,
  resolveTopic,
};
