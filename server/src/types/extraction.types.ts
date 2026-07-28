export type ExtractionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface PageExtractionData {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  success: boolean;
  text?: string;
  error?: string;
  /** Page-aware extraction for PDFs */
  pages?: PageExtractionData[];
  totalPages?: number;
}

export interface DocumentExtractionFields {
  extractedText?: string;
  extractionStatus: ExtractionStatus;
  extractionError?: string | null;
}
