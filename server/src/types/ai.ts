/** Mistral chat message roles supported by the RAG pipeline */
export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionOptions {
  /** Override the default chat model from env */
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  answer: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface EmbeddingTaskType {
  /** Document indexing — embeds content for storage */
  kind: "document";
}

export interface QueryEmbeddingTaskType {
  /** Search/RAG query — embeds user question for retrieval */
  kind: "query";
}

export type EmbeddingInputType = EmbeddingTaskType | QueryEmbeddingTaskType;
