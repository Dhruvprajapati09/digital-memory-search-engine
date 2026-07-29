import type { DocumentType } from "../../models/Document";
import type { MetadataHints } from "../../types/query";
import type { DateFilterPreset } from "../../types/search";

const DOCUMENT_TYPE_HINTS: Array<{ type: DocumentType; patterns: RegExp[] }> = [
  { type: "pdf", patterns: [/\bpdf\b/, /\bdocument\b/, /\bpaper\b/] },
  { type: "video", patterns: [/\bvideo\b/, /\byoutube\b/, /\bwatch\b/, /\btranscript\b/] },
  { type: "note", patterns: [/\bnote\b/, /\bnotes\b/, /\bjournal\b/] },
  { type: "image", patterns: [/\bimage\b/, /\bphoto\b/, /\bscreenshot\b/, /\bocr\b/] },
];

const DATE_HINTS: Array<{ date: DateFilterPreset; patterns: RegExp[] }> = [
  { date: "today", patterns: [/\btoday\b/, /\bthis morning\b/, /\btonight\b/] },
  { date: "7d", patterns: [/\blast week\b/, /\bpast week\b/, /\brecently\b/, /\blast 7 days\b/] },
  { date: "30d", patterns: [/\blast month\b/, /\bpast month\b/, /\blast 30 days\b/] },
];

/**
 * Infer metadata filters from natural language query patterns.
 */
export function detectMetadataHints(
  normalizedQuery: string,
  entities: string[],
  keywords: string[],
  vocabulary?: { tags?: Iterable<string>; concepts?: Iterable<string> }
): MetadataHints {
  const hints: MetadataHints = {};

  for (const { type, patterns } of DOCUMENT_TYPE_HINTS) {
    if (patterns.some((p) => p.test(normalizedQuery))) {
      hints.documentType = type;
      break;
    }
  }

  for (const { date, patterns } of DATE_HINTS) {
    if (patterns.some((p) => p.test(normalizedQuery))) {
      hints.date = date;
      break;
    }
  }

  // Topic hint from entities or longest keyword
  if (entities.length > 0) {
    hints.topic = entities[0];
  } else if (keywords.length > 0) {
    const longest = [...keywords].sort((a, b) => b.length - a.length)[0];
    if (longest.length >= 4) hints.topic = longest;
  }

  // Tag hints from vocabulary overlap
  const tagHints = new Set<string>();
  if (vocabulary?.tags) {
    for (const tag of vocabulary.tags) {
      const lower = tag.toLowerCase();
      if (normalizedQuery.includes(lower)) tagHints.add(tag);
    }
  }
  for (const kw of keywords) {
    if (kw.length >= 3) tagHints.add(kw);
  }
  if (tagHints.size > 0) {
    hints.tags = [...tagHints].slice(0, 5);
  }

  return hints;
}
