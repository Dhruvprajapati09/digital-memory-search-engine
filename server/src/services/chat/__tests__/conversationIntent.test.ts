import { describe, expect, it } from "vitest";
import { getConversationalResponse } from "../conversationIntent";

describe("getConversationalResponse", () => {
  it("recognizes the supported conversational messages", () => {
    for (const message of [
      "Hi",
      "hie",
      "Hello",
      "Good morning",
      "How are you?",
      "Thanks",
      "Bye",
      "  HIIII!!! ",
    ]) {
      expect(getConversationalResponse(message)).toBeDefined();
    }

    expect(getConversationalResponse("Good morning?")?.answer).toContain(
      "Good morning"
    );
    expect(getConversationalResponse("Who developed you?")?.answer).toBe(
      "I was developed by Dhruv Prajapati."
    );
    expect(getConversationalResponse("How are you?")?.answer).toContain(
      "doing well"
    );
  });

  it("does not classify document questions or mixed messages", () => {
    for (const message of [
      "What is my Digital Memory Search Engine project?",
      "Find my MongoDB notes.",
      "What did I write about React?",
      "Hi, what did I write about MongoDB?",
      "Hello, summarize my uploaded document.",
    ]) {
      expect(getConversationalResponse(message)).toBeUndefined();
    }
  });
});