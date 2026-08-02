import { describe, expect, it } from "vitest";
import { buildPriorMessagesForAnswer } from "../chatService";

describe("buildPriorMessagesForAnswer", () => {
  it("excludes failed noResults Q&A pairs so they cannot poison the next ask", () => {
    // History at the moment the next (good) ask is sent — new user turn not stored yet
    const priors = buildPriorMessagesForAnswer(
      [
        { role: "user", content: "Hidden Markov Modl", noResults: false },
        {
          role: "assistant",
          content: "I couldn't find that information in your saved documents.",
          noResults: true,
        },
      ],
      4
    );

    expect(priors).toEqual([]);
  });

  it("keeps successful turns", () => {
    const priors = buildPriorMessagesForAnswer(
      [
        { role: "user", content: "What is X?", noResults: false },
        { role: "assistant", content: "X is …", noResults: false },
        { role: "user", content: "Give an example", noResults: false },
      ],
      4
    );

    expect(priors).toEqual([
      { role: "user", content: "What is X?" },
      { role: "assistant", content: "X is …" },
      { role: "user", content: "Give an example" },
    ]);
  });

  it("keeps earlier success and drops a later failed pair", () => {
    const priors = buildPriorMessagesForAnswer(
      [
        { role: "user", content: "Define Markov Model", noResults: false },
        { role: "assistant", content: "A Markov Model is …", noResults: false },
        { role: "user", content: "typo query", noResults: false },
        {
          role: "assistant",
          content: "I couldn't find that information.",
          noResults: true,
        },
      ],
      4
    );

    expect(priors).toEqual([
      { role: "user", content: "Define Markov Model" },
      { role: "assistant", content: "A Markov Model is …" },
    ]);
  });

  it("drops LLM-echoed no-answer turns even when noResults is false", () => {
    const priors = buildPriorMessagesForAnswer(
      [
        { role: "user", content: "html", noResults: false },
        {
          role: "assistant",
          content: "I couldn't find that information in your saved documents.",
          noResults: false,
        },
        { role: "user", content: "what is html?", noResults: false },
      ],
      4
    );

    expect(priors).toEqual([{ role: "user", content: "what is html?" }]);
  });
});
