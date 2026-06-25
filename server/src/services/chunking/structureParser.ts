import type { ParsedSection } from "../../types/chunking";

const MARKDOWN_HEADING = /^(#{1,6})\s+(.+)$/;
const NUMBERED_HEADING = /^(\d+(?:\.\d+)*)\.\s+(.+)$/;
const BULLET_LINE = /^[\s]*[-*•]\s+/;
const ORDERED_LIST = /^[\s]*\d+[.)]\s+/;

function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return false;

  if (MARKDOWN_HEADING.test(trimmed)) return true;
  if (NUMBERED_HEADING.test(trimmed)) return true;

  // Short ALL-CAPS lines (e.g. "MEMOIZATION")
  if (
    trimmed.length >= 3 &&
    trimmed.length <= 60 &&
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed) &&
    !/^\d/.test(trimmed)
  ) {
    return true;
  }

  // Title-case short line ending without period
  if (
    trimmed.length <= 80 &&
    !trimmed.endsWith(".") &&
    !trimmed.endsWith("?") &&
    !trimmed.endsWith("!") &&
    /^[A-Z][a-zA-Z0-9\s/&:-]+$/.test(trimmed) &&
    trimmed.split(/\s+/).length <= 10
  ) {
    return true;
  }

  return false;
}

function headingLevel(line: string): number {
  const trimmed = line.trim();
  const md = trimmed.match(MARKDOWN_HEADING);
  if (md) return md[1].length;

  const numbered = trimmed.match(NUMBERED_HEADING);
  if (numbered) return numbered[1].split(".").length;

  if (trimmed === trimmed.toUpperCase()) return 1;

  return 2;
}

function headingTitle(line: string): string {
  const trimmed = line.trim();
  const md = trimmed.match(MARKDOWN_HEADING);
  if (md) return md[2].trim();

  const numbered = trimmed.match(NUMBERED_HEADING);
  if (numbered) return numbered[2].trim();

  return trimmed.replace(/^#+\s*/, "").trim();
}

function isListLine(line: string): boolean {
  return BULLET_LINE.test(line) || ORDERED_LIST.test(line);
}

/**
 * Detect document structure: headings, sections, bullet groups, paragraphs.
 * Returns a tree rooted at a synthetic document node.
 */
export function parseDocumentStructure(
  text: string,
  documentTitle = "Document"
): ParsedSection {
  const lines = text.split(/\r?\n/);
  const root: ParsedSection = {
    title: documentTitle,
    level: 0,
    content: "",
    children: [],
    lineStart: 0,
    lineEnd: lines.length - 1,
  };

  const stack: ParsedSection[] = [root];
  let currentParagraph: string[] = [];
  let paragraphStart = 0;

  const flushParagraph = (lineIndex: number) => {
    if (currentParagraph.length === 0) return;

    const parent = stack[stack.length - 1];
    const block = currentParagraph.join("\n").trim();
    if (block) {
      parent.content = parent.content
        ? `${parent.content}\n\n${block}`
        : block;
    }

    parent.lineEnd = lineIndex;
    currentParagraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(i);
      continue;
    }

    if (isLikelyHeading(trimmed)) {
      flushParagraph(i);

      const title = headingTitle(trimmed);

      // Skip redundant H1 that duplicates the document title — attach sections to root
      if (
        stack.length === 1 &&
        title.toLowerCase() === documentTitle.toLowerCase()
      ) {
        continue;
      }

      const level = headingLevel(trimmed);
      const section: ParsedSection = {
        title,
        level,
        content: "",
        children: [],
        lineStart: i,
        lineEnd: i,
      };

      // Pop stack until we find a parent with lower level
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      stack[stack.length - 1].children.push(section);
      stack.push(section);
      continue;
    }

    // Keep list blocks attached to the current section
    if (currentParagraph.length === 0) {
      paragraphStart = i;
    }

    if (isListLine(line) || currentParagraph.some((l) => isListLine(l))) {
      currentParagraph.push(line);
    } else if (currentParagraph.length > 0 && isListLine(currentParagraph[0])) {
      flushParagraph(i - 1);
      currentParagraph = [line];
      paragraphStart = i;
    } else {
      currentParagraph.push(line);
    }
  }

  flushParagraph(lines.length - 1);

  // No headings found — treat entire text as one section under root
  if (root.children.length === 0 && !root.content.trim()) {
    root.content = text.trim();
  }

  return root;
}

/** Flatten section tree to leaf sections with full path context */
export function flattenSections(
  section: ParsedSection,
  path: string[] = []
): Array<{ section: ParsedSection; path: string[] }> {
  const currentPath = section.level > 0 ? [...path, section.title] : path;
  const results: Array<{ section: ParsedSection; path: string[] }> = [];

  const hasOwnContent = section.content.trim().length > 0;
  const hasChildren = section.children.length > 0;

  if (hasOwnContent && !hasChildren) {
    results.push({ section, path: currentPath });
  } else if (hasOwnContent && hasChildren) {
    results.push({ section, path: currentPath });
  }

  for (const child of section.children) {
    results.push(...flattenSections(child, currentPath));
  }

  // Leaf section with only children content rolled up
  if (!hasOwnContent && !hasChildren && section.level > 0) {
    results.push({ section, path: currentPath });
  }

  return results;
}
