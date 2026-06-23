export type ExtractionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface ExtractionResult {
  success: boolean;
  text?: string;
  error?: string;
}

export interface DocumentExtractionFields {
  extractedText?: string;
  extractionStatus: ExtractionStatus;
  extractionError?: string | null;
}
