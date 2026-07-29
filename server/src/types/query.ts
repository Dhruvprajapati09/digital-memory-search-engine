import type { DocumentType } from "../models/Document";
import type { DateFilterPreset } from "./search";

export type QueryIntent =
  | "definition"
  | "comparison"
  | "tutorial"
  | "code"
  | "summary"
  | "question"
  | "search"
  | "lookup"
  | "examples"
  | "classification";

export interface QueryNormalizationResult {
  original: string;
  normalized: string;
}

export interface MetadataHints {
  documentType?: DocumentType;
  topic?: string;
  tags?: string[];
  date?: DateFilterPreset;
  dateFrom?: string;
  dateTo?: string;
}

export interface QueryPipelineResult {
  original: string;
  normalized: string;
  intent: QueryIntent;
  confidence: number;
  entities: string[];
  keywords: string[];
  expandedTerms: string[];
  metadataHints: MetadataHints;
}

export interface UserVocabulary {
  keywords: Set<string>;
  concepts: Set<string>;
  tags: Set<string>;
  documentTitles: Set<string>;
}
