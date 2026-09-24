export interface ConversationalResponse {
  answer: string;
}

function normalizeMessage(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getConversationalResponse(
  message: string
): ConversationalResponse | undefined {
  const normalized = normalizeMessage(message);

  if (/^hi+$/.test(normalized)) {
    return { answer: "Hi! How can I help you with your memories today?" };
  }

  if (/^hey+$/.test(normalized)) {
    return { answer: "Hey! How can I help you with your memories today?" };
  }

  if (/^hello+$/.test(normalized)) {
    return { answer: "Hello! How can I help you?" };
  }

  const responses: Record<string, string> = {
    hie: "Hi sir! How can I help you?",
    "good morning": "Good morning! How can I help you today?",
    "good afternoon": "Good afternoon! How can I help you today?",
    "good evening": "Good evening! How can I help you?",
    "good night": "Good night! Feel free to come back whenever you need me.",
    "how are you": "I'm doing well! How can I help you with your memories?",
    thanks: "You're welcome!",
    "thank you": "You're welcome!",
    bye: "Goodbye! Feel free to come back whenever you need to search your memories.",
    goodbye: "Goodbye! Feel free to come back whenever you need to search your memories.",
    ok: "Okay! How can I help you with your memories?",
    okay: "Okay! How can I help you with your memories?",
    great: "Great! How can I help you with your memories?",
    nice: "Nice! How can I help you with your memories?",
    "who are you": "I'm your Digital Memory Assistant. I can help you search your memories.",
    "who developed you": "I was developed by Dhruv Prajapati.",
    "what can you do": "I can help you search and understand your saved memories.",
  };

  const answer = responses[normalized];
  return answer ? { answer } : undefined;
}