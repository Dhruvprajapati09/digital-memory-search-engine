import type { QueryPipelineResult } from "../../types/query";
import type {
  SearchV2QueryRewrite,
  SearchV2SemanticFilters,
} from "../../types/searchV2";

const FRAMEWORK_LANGUAGE_HINTS: Array<{
  pattern: RegExp;
  framework: string;
  language: string;
  tags: string[];
}> = [
  {
    pattern: /\breact|jsx|hooks?|usememo|usecallback\b/i,
    framework: "React",
    language: "JavaScript",
    tags: ["react", "javascript"],
  },
  {
    pattern: /\bexpress|node\.?js|middleware\b/i,
    framework: "Express",
    language: "JavaScript",
    tags: ["node", "express", "javascript"],
  },
  {
    pattern: /\btypescript|ts\b/i,
    framework: "TypeScript",
    language: "TypeScript",
    tags: ["typescript"],
  },
  {
    pattern: /\bpython|django|flask|fastapi\b/i,
    framework: "Python",
    language: "Python",
    tags: ["python"],
  },
];

export function predictSemanticFilters(
  queryAnalysis: QueryPipelineResult,
  rewrite: SearchV2QueryRewrite
): SearchV2SemanticFilters {
  const text = [
    rewrite.correctedQuery,
    rewrite.rewrittenQuery,
    ...queryAnalysis.entities,
    ...queryAnalysis.keywords,
  ].join(" ");

  const filters: SearchV2SemanticFilters = {
    topic: queryAnalysis.metadataHints.topic,
    entity: queryAnalysis.entities[0],
    tags: [...(queryAnalysis.metadataHints.tags ?? [])],
  };

  for (const hint of FRAMEWORK_LANGUAGE_HINTS) {
    if (!hint.pattern.test(text)) continue;
    filters.framework = hint.framework;
    filters.language = hint.language;
    filters.tags = [...new Set([...filters.tags, ...hint.tags])];
    break;
  }

  return filters;
}
