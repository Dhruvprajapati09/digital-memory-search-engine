import { env } from "../../config/env";
import type {
  LayoutBlock,
  PageContent,
  StructureElementType,
} from "../../types/documentIntelligence";

const MARKDOWN_HEADING = /^(#{1,6})\s+(.+)$/;
const CODE_FENCE = /^```(\w*)/;
const TABLE_ROW = /^\|.+\|$/;
const TABLE_SEPARATOR = /^\|[-:\s|]+\|$/;
const FIGURE_CAPTION = /^(?:figure|fig\.?)\s+\d+[.:]/i;
const IMAGE_ALT = /^!\[([^\]]*)\]\(([^)]+)\)/;

/**
 * Analyze document layout into structural blocks (headings, paragraphs, lists, tables, code, figures).
 */
export function analyzeLayout(
  text: string,
  pages: PageContent[] = []
): LayoutBlock[] {
  if (!env.ENABLE_LAYOUT_ANALYSIS) {
    return [
      {
        type: "paragraph",
        text: text.trim(),
        lineStart: 0,
        lineEnd: text.split(/\r?\n/).length - 1,
        pageNumber: pages[0]?.pageNumber,
      },
    ];
  }

  const lines = text.split(/\r?\n/);
  const blocks: LayoutBlock[] = [];
  let i = 0;

  const resolvePage = (lineIndex: number): number | undefined =>
    pages.find(
      (p) => lineIndex >= p.lineStart && lineIndex <= p.lineEnd
    )?.pageNumber;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Code fence block
    const codeMatch = trimmed.match(CODE_FENCE);
    if (codeMatch) {
      const start = i;
      const language = codeMatch[1] || undefined;
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;

      blocks.push({
        type: "code_block",
        text: codeLines.join("\n"),
        lineStart: start,
        lineEnd: i - 1,
        pageNumber: resolvePage(start),
        metadata: { language },
      });
      continue;
    }

    // Markdown heading
    const headingMatch = trimmed.match(MARKDOWN_HEADING);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const blockType: StructureElementType =
        level === 1 ? "title" : level === 2 ? "heading" : "subheading";

      blocks.push({
        type: blockType,
        text: headingMatch[2].trim(),
        lineStart: i,
        lineEnd: i,
        pageNumber: resolvePage(i),
        metadata: { level },
      });
      i += 1;
      continue;
    }

    // Table block
    if (TABLE_ROW.test(trimmed)) {
      const start = i;
      const tableLines: string[] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i += 1;
      }

      if (tableLines.length >= 2 && TABLE_SEPARATOR.test(tableLines[1])) {
        blocks.push({
          type: "table",
          text: tableLines.join("\n"),
          lineStart: start,
          lineEnd: i - 1,
          pageNumber: resolvePage(start),
          metadata: { preserved: true },
        });
        continue;
      }

      i = start + 1;
    }

    // Figure / image reference
    if (FIGURE_CAPTION.test(trimmed) || IMAGE_ALT.test(trimmed)) {
      blocks.push({
        type: FIGURE_CAPTION.test(trimmed) ? "caption" : "figure",
        text: trimmed,
        lineStart: i,
        lineEnd: i,
        pageNumber: resolvePage(i),
      });
      i += 1;
      continue;
    }

    // List block
    if (/^[\s]*[-*•]\s+/.test(line) || /^[\s]*\d+[.)]\s+/.test(line)) {
      const start = i;
      const listLines: string[] = [];
      while (
        i < lines.length &&
        (/^[\s]*[-*•]\s+/.test(lines[i]) ||
          /^[\s]*\d+[.)]\s+/.test(lines[i]) ||
          (/^\s{2,}\S/.test(lines[i]) && listLines.length > 0))
      ) {
        listLines.push(lines[i]);
        i += 1;
      }

      blocks.push({
        type: "list",
        text: listLines.join("\n"),
        lineStart: start,
        lineEnd: i - 1,
        pageNumber: resolvePage(start),
      });
      continue;
    }

    // Paragraph (collect until blank line or special block)
    const start = i;
    const paraLines: string[] = [line];
    i += 1;

    while (i < lines.length) {
      const next = lines[i];
      const nextTrimmed = next.trim();

      if (
        !nextTrimmed ||
        MARKDOWN_HEADING.test(nextTrimmed) ||
        CODE_FENCE.test(nextTrimmed) ||
        TABLE_ROW.test(nextTrimmed) ||
        FIGURE_CAPTION.test(nextTrimmed) ||
        IMAGE_ALT.test(nextTrimmed) ||
        /^[\s]*[-*•]\s+/.test(next) ||
        /^[\s]*\d+[.)]\s+/.test(next)
      ) {
        break;
      }

      paraLines.push(next);
      i += 1;
    }

    blocks.push({
      type: "paragraph",
      text: paraLines.join("\n").trim(),
      lineStart: start,
      lineEnd: i - 1,
      pageNumber: resolvePage(start),
    });
  }

  return blocks;
}
