import { env } from "../../config/env";
import type {
  ExtractedEntity,
  IndexEntityType,
  SemanticChunk,
} from "../../types/documentIntelligence";
import { TECH_ENTITY_DICTIONARY } from "../query/entityExtractionService";

const URL_REGEX =
  /\bhttps?:\/\/[^\s<>[\](){}'"`,]+/gi;

const REST_API_REGEX =
  /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[\w/{}:-]+/gi;

const CLASS_REGEX = /\bclass\s+(\w+)/g;
const FUNCTION_REGEX = /\bfunction\s+(\w+)|\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
const INTERFACE_REGEX = /\binterface\s+(\w+)/g;

const PERSON_REGEX =
  /\b(?:Mr|Mrs|Ms|Dr|Prof)\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g;

const COMPANY_SUFFIX_REGEX =
  /\b[A-Z][a-zA-Z0-9&]+(?:\s+[A-Z][a-zA-Z0-9&]+)*\s+(?:Inc|LLC|Ltd|Corp|Co|GmbH)\b/g;

function buildDictionaryMap(): Map<string, { name: string; type: IndexEntityType }> {
  const map = new Map<string, { name: string; type: IndexEntityType }>();

  const typeMap: Record<string, IndexEntityType> = {
    MongoDB: "database",
    PostgreSQL: "database",
    MySQL: "database",
    Redis: "database",
    Pinecone: "database",
    React: "framework",
    Vue: "framework",
    Angular: "framework",
    "Next.js": "framework",
    Express: "framework",
    JavaScript: "programming_language",
    TypeScript: "programming_language",
    Python: "programming_language",
    Docker: "library",
    Kubernetes: "library",
    Webpack: "library",
    Vite: "library",
    TensorFlow: "library",
    PyTorch: "library",
  };

  for (const entity of TECH_ENTITY_DICTIONARY) {
    const lower = entity.toLowerCase();
    map.set(lower, {
      name: entity,
      type: typeMap[entity] ?? "framework",
    });
  }

  return map;
}

const DICTIONARY_MAP = buildDictionaryMap();

function addEntity(
  found: Map<string, ExtractedEntity>,
  name: string,
  type: IndexEntityType
): void {
  const trimmed = name.trim();
  if (trimmed.length < 2) return;
  found.set(trimmed.toLowerCase(), { name: trimmed, type });
}

/**
 * Extract searchable entities from chunk text (deterministic, no LLM).
 */
export function extractEntitiesFromText(text: string): ExtractedEntity[] {
  if (!env.ENABLE_ENTITY_EXTRACTION_INDEX) return [];

  const found = new Map<string, ExtractedEntity>();

  const sortedDict = [...DICTIONARY_MAP.entries()].sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [lower, entity] of sortedDict) {
    const pattern = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${pattern.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (regex.test(text)) {
      addEntity(found, entity.name, entity.type);
    }
  }

  const urls = text.match(URL_REGEX) ?? [];
  for (const url of urls) addEntity(found, url, "url");

  REST_API_REGEX.lastIndex = 0;
  const apis = text.match(REST_API_REGEX) ?? [];
  for (const api of apis) addEntity(found, api, "rest_api");

  CLASS_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CLASS_REGEX.exec(text)) !== null) {
    addEntity(found, match[1], "class");
  }

  FUNCTION_REGEX.lastIndex = 0;
  while ((match = FUNCTION_REGEX.exec(text)) !== null) {
    const fn = match[1] ?? match[2];
    if (fn && !["if", "for", "while", "switch", "catch"].includes(fn)) {
      addEntity(found, fn, "function");
    }
  }

  INTERFACE_REGEX.lastIndex = 0;
  while ((match = INTERFACE_REGEX.exec(text)) !== null) {
    addEntity(found, match[1], "interface");
  }

  const camelIds = text.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) ?? [];
  for (const id of camelIds.slice(0, 10)) {
    if (!found.has(id.toLowerCase())) {
      addEntity(found, id, "function");
    }
  }

  const persons = text.match(PERSON_REGEX) ?? [];
  for (const person of persons) addEntity(found, person, "person");

  const companies = text.match(COMPANY_SUFFIX_REGEX) ?? [];
  for (const company of companies) addEntity(found, company, "company");

  return [...found.values()];
}

/** Extract entities for all chunks */
export function extractEntitiesFromChunks(
  chunks: SemanticChunk[]
): SemanticChunk[] {
  if (!env.ENABLE_ENTITY_EXTRACTION_INDEX) return chunks;

  return chunks.map((chunk) => ({
    ...chunk,
    entities: extractEntitiesFromText(
      `${chunk.title} ${chunk.topic} ${chunk.text}`
    ),
  }));
}

/** Aggregate unique entities across all chunks */
export function aggregateDocumentEntities(
  chunks: SemanticChunk[]
): ExtractedEntity[] {
  const found = new Map<string, ExtractedEntity>();

  for (const chunk of chunks) {
    for (const entity of chunk.entities ?? []) {
      found.set(entity.name.toLowerCase(), entity);
    }
  }

  return [...found.values()];
}
