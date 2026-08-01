import mongoose from "mongoose";
import ConversationModel, {
  type IConversation,
  type IConversationMessage,
  type IConversationSource,
} from "../../models/Conversation";
import { generateAnswer } from "../ai/answerService";
import {
  QuestionValidationError,
  validateQuestion,
} from "../ai/promptBuilder";
import { AppError } from "../../middleware/error.middleware";
import type {
  ConversationDto,
  ConversationMessageDto,
  ConversationSourceDto,
  ConversationSummaryDto,
} from "../../types/chat";
import type { AiSource, PriorChatMessage } from "../../types/ai";

/** Last N messages (2 Q&A pairs) used as in-chat context for the LLM */
const PRIOR_MESSAGE_LIMIT = 4;
const TITLE_MAX_LENGTH = 50;

type PriorSourceMessage = Pick<
  IConversationMessage,
  "role" | "content" | "noResults"
>;

/** True when an assistant turn should not be fed back as prior context. */
function isFailedAssistantPrior(msg: PriorSourceMessage): boolean {
  if (msg.role !== "assistant") return false;
  if (msg.noResults) return true;
  // LLM-echoed canned no-answer is stored with noResults:false when chunks existed
  return /couldn't find that information/i.test(msg.content);
}

/**
 * Build LLM prior turns from conversation history.
 * Drops failed Q&A pairs (empty retrieval or canned no-answer + preceding user)
 * so they cannot poison the next ask.
 */
export function buildPriorMessagesForAnswer(
  messages: PriorSourceMessage[],
  limit = PRIOR_MESSAGE_LIMIT
): PriorChatMessage[] {
  const window = messages.slice(-limit);
  const filtered: PriorSourceMessage[] = [];

  for (let i = 0; i < window.length; i += 1) {
    const msg = window[i];
    if (isFailedAssistantPrior(msg)) {
      // Drop this assistant turn and its preceding user turn if present
      if (
        filtered.length > 0 &&
        filtered[filtered.length - 1]?.role === "user"
      ) {
        filtered.pop();
      }
      continue;
    }
    filtered.push(msg);
  }

  return filtered
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.trim(),
    }));
}

function toSourceDto(source: IConversationSource): ConversationSourceDto {
  return {
    documentId: source.documentId,
    documentName: source.documentName,
    preview: source.preview,
    ...(typeof source.page === "number" ? { page: source.page } : {}),
  };
}

function toMessageDto(message: IConversationMessage): ConversationMessageDto {
  return {
    _id: message._id?.toString() ?? new mongoose.Types.ObjectId().toString(),
    role: message.role,
    content: message.content,
    sources: (message.sources ?? []).map(toSourceDto),
    noResults: Boolean(message.noResults),
    createdAt: message.createdAt.toISOString(),
  };
}

function toConversationDto(conversation: IConversation): ConversationDto {
  return {
    _id: conversation._id.toString(),
    title: conversation.title,
    messages: (conversation.messages ?? []).map(toMessageDto),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function slimSources(sources: AiSource[]): IConversationSource[] {
  return sources.map((source) => ({
    documentId: source.documentId,
    documentName: source.documentName || "Untitled",
    preview: source.highlightedText || "",
    ...(typeof source.page === "number" ? { page: source.page } : {}),
  }));
}

function titleFromQuestion(question: string): string {
  const trimmed = question.trim().replace(/\s+/g, " ");
  if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

function assertValidObjectId(id: string): void {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Conversation not found", 404);
  }
}

export async function listConversations(
  userId: string
): Promise<ConversationSummaryDto[]> {
  const conversations = await ConversationModel.find({ userId })
    .sort({ updatedAt: -1 })
    .select("title updatedAt createdAt")
    .lean()
    .exec();

  return conversations.map((c) => ({
    _id: c._id.toString(),
    title: c.title,
    updatedAt: c.updatedAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  }));
}

export async function createConversation(
  userId: string
): Promise<ConversationDto> {
  const conversation = await ConversationModel.create({
    userId,
    title: "New chat",
    messages: [],
  });

  return toConversationDto(conversation);
}

export async function getConversation(
  userId: string,
  conversationId: string
): Promise<ConversationDto> {
  assertValidObjectId(conversationId);

  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    userId,
  }).exec();

  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  return toConversationDto(conversation);
}

export async function deleteConversation(
  userId: string,
  conversationId: string
): Promise<void> {
  assertValidObjectId(conversationId);

  const result = await ConversationModel.deleteOne({
    _id: conversationId,
    userId,
  }).exec();

  if (result.deletedCount === 0) {
    throw new AppError("Conversation not found", 404);
  }
}

export async function askInConversation(
  userId: string,
  conversationId: string,
  rawQuestion: string
): Promise<{
  userMessage: ConversationMessageDto;
  assistantMessage: ConversationMessageDto;
}> {
  assertValidObjectId(conversationId);

  let question: string;
  try {
    question = validateQuestion(rawQuestion);
  } catch (err) {
    if (err instanceof QuestionValidationError) {
      throw new AppError(err.message, err.statusCode);
    }
    throw err;
  }

  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    userId,
  }).exec();

  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  const priorSource = conversation.messages.slice(-PRIOR_MESSAGE_LIMIT);
  const priorHasNoResults = priorSource.some(
    (m) => m.role === "assistant" && m.noResults
  );
  const priorMessages = buildPriorMessagesForAnswer(conversation.messages);

  console.log("[rag/chat]", {
    conversationId,
    priorCount: priorMessages.length,
    priorHasNoResults,
    question,
  });

  const answerResult = await generateAnswer(userId, {
    question,
    priorMessages,
    conversationId,
  });

  console.log("[rag/chat]", {
    conversationId,
    noResults: Boolean(answerResult.noResults),
    question,
  });

  conversation.messages.push({
    role: "user",
    content: question,
    sources: [],
    noResults: false,
    createdAt: new Date(),
  });

  conversation.messages.push({
    role: "assistant",
    content: answerResult.answer,
    sources: slimSources(answerResult.sources),
    noResults: Boolean(answerResult.noResults),
    createdAt: new Date(),
  });

  if (conversation.title === "New chat") {
    conversation.title = titleFromQuestion(question);
  }

  conversation.updatedAt = new Date();
  await conversation.save();

  const savedUser =
    conversation.messages[conversation.messages.length - 2];
  const savedAssistant =
    conversation.messages[conversation.messages.length - 1];

  return {
    userMessage: toMessageDto(savedUser),
    assistantMessage: toMessageDto(savedAssistant),
  };
}
