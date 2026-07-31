import { searchDocumentsPure } from "./documentSearch/documentSearchService";
import type { SearchRequest, SearchResponse } from "../types/search";

/**
 * Module 1 Document Search Engine entrypoint.
 * Pure text search only — does not call embeddings, Pinecone, or RAG retrieve().
 */
export async function searchDocuments(
  userId: string,
  params: SearchRequest
): Promise<SearchResponse> {
  return searchDocumentsPure(userId, params);
}
