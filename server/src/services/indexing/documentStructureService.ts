import { env } from "../../config/env";
import type {
  CodeBlockInfo,
  DocumentStructureElement,
  LayoutBlock,
  PageContent,
  TableStructure,
} from "../../types/documentIntelligence";
import {
  parseDocumentStructure,
  flattenSections,
} from "../chunking/structureParser";
import { resolvePageForLine, resolvePageRange } from "./pageExtractionService";

function parseMarkdownTable(text: string): TableStructure | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

  const headers = parseRow(lines[0]);
  const separator = lines[1];
  if (!/^\|[-:\s|]+\|$/.test(separator.trim())) return null;

  const rows = lines.slice(2).map(parseRow).filter((r) => r.length > 0);

  return { headers, rows };
}

function parseCodeBlock(text: string, language?: string): CodeBlockInfo {
  const info: CodeBlockInfo = {
    language,
    classes: [],
    functions: [],
    interfaces: [],
    packages: [],
    imports: [],
    apis: [],
  };

  if (!env.ENABLE_CODE_ANALYSIS) return info;

  const classMatches = text.match(/\bclass\s+(\w+)/g) ?? [];
  info.classes = classMatches.map((m) => m.replace(/\bclass\s+/, ""));

  const fnMatches = text.match(/\bfunction\s+(\w+)|\b(\w+)\s*\([^)]*\)\s*\{/g) ?? [];
  for (const m of fnMatches) {
    const fn = m.match(/\bfunction\s+(\w+)/)?.[1] ??
      m.match(/^(\w+)\s*\(/)?.[1];
    if (fn && !["if", "for", "while", "switch"].includes(fn)) {
      info.functions.push(fn);
    }
  }

  const interfaceMatches = text.match(/\binterface\s+(\w+)/g) ?? [];
  info.interfaces = interfaceMatches.map((m) =>
    m.replace(/\binterface\s+/, "")
  );

  const importMatches =
    text.match(/(?:import|from)\s+['"]([^'"]+)['"]/g) ?? [];
  info.imports = importMatches.map((m) => {
    const pkg = m.match(/['"]([^'"]+)['"]/)?.[1];
    return pkg ?? m;
  });

  const packageMatches = text.match(/\b(?:package|namespace)\s+([\w.]+)/g) ?? [];
  info.packages = packageMatches.map((m) =>
    m.replace(/\b(?:package|namespace)\s+/, "")
  );

  const apiMatches =
    text.match(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[\w/{}:-]+/gi) ?? [];
  info.apis = [...new Set(apiMatches)];

  return info;
}

function buildFromLayoutBlocks(
  blocks: LayoutBlock[],
  pages: PageContent[],
  documentTitle: string
): DocumentStructureElement {
  const root: DocumentStructureElement = {
    type: "title",
    title: documentTitle,
    content: "",
    level: 0,
    children: [],
    lineStart: 0,
    lineEnd: blocks.length > 0 ? blocks[blocks.length - 1].lineEnd : 0,
  };

  const stack: DocumentStructureElement[] = [root];
  let currentChapter: string | undefined;
  let currentSection: string | undefined;
  let currentHeading: string | undefined;

  for (const block of blocks) {
    const pageInfo = resolvePageForLine(pages, block.lineStart);
    const pageRange = resolvePageRange(
      pages,
      block.lineStart,
      block.lineEnd
    );

    if (block.type === "title" || block.type === "heading") {
      if (block.type === "title" || block.metadata?.level === 1) {
        currentChapter = block.text;
      }
      currentSection = block.text;
      currentHeading = block.text;

      const element: DocumentStructureElement = {
        type: block.type,
        title: block.text,
        content: "",
        level: (block.metadata?.level as number) ?? (block.type === "title" ? 1 : 2),
        pageNumber: block.pageNumber ?? pageInfo?.pageNumber,
        pageRange,
        chapter: currentChapter,
        section: currentSection,
        heading: currentHeading,
        parentHeading: stack.length > 1 ? stack[stack.length - 1].heading : undefined,
        children: [],
        lineStart: block.lineStart,
        lineEnd: block.lineEnd,
      };

      while (
        stack.length > 1 &&
        stack[stack.length - 1].level >= element.level
      ) {
        stack.pop();
      }

      stack[stack.length - 1].children.push(element);
      stack.push(element);
      continue;
    }

    if (block.type === "subheading") {
      currentHeading = block.text;
      const element: DocumentStructureElement = {
        type: "subheading",
        title: block.text,
        content: "",
        level: (block.metadata?.level as number) ?? 3,
        pageNumber: block.pageNumber ?? pageInfo?.pageNumber,
        pageRange,
        chapter: currentChapter,
        section: currentSection,
        heading: currentHeading,
        parentHeading: stack.length > 1 ? stack[stack.length - 1].heading : undefined,
        children: [],
        lineStart: block.lineStart,
        lineEnd: block.lineEnd,
      };

      while (
        stack.length > 1 &&
        stack[stack.length - 1].level >= element.level
      ) {
        stack.pop();
      }

      stack[stack.length - 1].children.push(element);
      stack.push(element);
      continue;
    }

    const parent = stack[stack.length - 1];

    if (block.type === "table" && env.ENABLE_TABLE_ANALYSIS) {
      const table = parseMarkdownTable(block.text);
      if (table) {
        table.pageNumber = block.pageNumber;
        parent.tables = [...(parent.tables ?? []), table];
        parent.content = parent.content
          ? `${parent.content}\n\n${block.text}`
          : block.text;
        continue;
      }
    }

    if (block.type === "code_block" && env.ENABLE_CODE_ANALYSIS) {
      const codeInfo = parseCodeBlock(
        block.text,
        block.metadata?.language as string | undefined
      );
      parent.codeBlocks = [...(parent.codeBlocks ?? []), codeInfo];
    }

    if (block.type === "figure" || block.type === "caption") {
      if (env.ENABLE_IMAGE_ANALYSIS) {
        parent.images = [
          ...(parent.images ?? []),
          {
            ocrText: block.type === "figure" ? block.text : undefined,
            caption: block.type === "caption" ? block.text : undefined,
            pageNumber: block.pageNumber,
          },
        ];
      }
    }

    const blockType = block.type === "list" ? "list" : "paragraph";
    if (parent.content) {
      parent.content = `${parent.content}\n\n${block.text}`;
    } else {
      parent.content = block.text;
    }

    if (!parent.pageNumber && block.pageNumber) {
      parent.pageNumber = block.pageNumber;
    }
    if (!parent.pageRange && pageRange) {
      parent.pageRange = pageRange;
    }

    parent.lineEnd = block.lineEnd;
    parent.type = parent.type === "title" ? "section" : parent.type;

    if (blockType === "list" && !parent.content.includes("\n-")) {
      parent.type = "section";
    }
  }

  return root;
}

/**
 * Build hierarchical document structure from layout blocks or fallback structure parser.
 */
export function buildDocumentStructure(
  text: string,
  documentTitle: string,
  layoutBlocks?: LayoutBlock[],
  pages: PageContent[] = []
): DocumentStructureElement {
  if (layoutBlocks && layoutBlocks.length > 0) {
    return buildFromLayoutBlocks(layoutBlocks, pages, documentTitle);
  }

  const parsed = parseDocumentStructure(text, documentTitle);
  const flat = flattenSections(parsed);

  const root: DocumentStructureElement = {
    type: "title",
    title: documentTitle,
    content: parsed.content,
    level: 0,
    chapter: documentTitle,
    children: [],
    lineStart: 0,
    lineEnd: text.split(/\r?\n/).length - 1,
  };

  for (const { section, path } of flat) {
    const pageInfo = resolvePageForLine(pages, section.lineStart);
    const pageRange = resolvePageRange(
      pages,
      section.lineStart,
      section.lineEnd
    );

    const chapter = path[0] ?? documentTitle;
    const sectionName = path.length > 1 ? path[path.length - 1] : path[0];
    const heading = section.title;

    root.children.push({
      type: section.level <= 1 ? "heading" : "section",
      title: section.title,
      content: section.content,
      level: section.level,
      pageNumber: pageInfo?.pageNumber,
      pageRange,
      chapter,
      section: sectionName,
      heading,
      parentHeading: path.length > 1 ? path[path.length - 2] : undefined,
      children: [],
      lineStart: section.lineStart,
      lineEnd: section.lineEnd,
    });
  }

  if (root.children.length === 0) {
    root.content = text.trim();
    root.type = "section";
  }

  return root;
}

/** Flatten structure tree to leaf sections for chunking */
export function flattenStructureElements(
  element: DocumentStructureElement
): DocumentStructureElement[] {
  const results: DocumentStructureElement[] = [];

  const hasContent = element.content.trim().length > 0;
  const hasChildren = element.children.length > 0;

  if (hasContent) {
    results.push(element);
  }

  for (const child of element.children) {
    results.push(...flattenStructureElements(child));
  }

  if (!hasContent && !hasChildren && element.level > 0) {
    results.push(element);
  }

  return results;
}
