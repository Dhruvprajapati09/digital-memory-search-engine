export interface ChatSource {
  documentId: string
  documentName: string
  preview: string
  page?: number
}

export interface ChatMessage {
  _id: string
  role: 'user' | 'assistant'
  content: string
  sources: ChatSource[]
  noResults: boolean
  createdAt: string
}

export interface ConversationSummary {
  _id: string
  title: string
  updatedAt: string
  createdAt?: string
}

export interface Conversation {
  _id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface ListConversationsResponse {
  success: boolean
  conversations: ConversationSummary[]
}

export interface ConversationResponse {
  success: boolean
  conversation: Conversation
}

export interface AskResponse {
  success: boolean
  userMessage: ChatMessage
  assistantMessage: ChatMessage
}
