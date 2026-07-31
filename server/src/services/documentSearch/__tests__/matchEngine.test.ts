import { describe, it, expect } from "vitest";
import {
  buildHighlightTerms,
  buildMatchSnippet,
  findMatchesInText,
  normalizeQueryWhitespace,
  tokenizeSearchQuery,
} from "../matchEngine";

describe("matchEngine", () => {
  it("normalizes query whitespace", () => {
    expect(normalizeQueryWhitespace("  machine   learning ")).toBe(
      "machine learning"
    );
  });

  it("tokenizes search queries", () => {
    expect(tokenizeSearchQuery("machine learning")).toEqual([
      "machine",
      "learning",
    ]);
  });

  it("finds case-insensitive phrase matches by default", () => {
    const text =
      "Intro. Machine Learning is a subset of Artificial Intelligence. More Machine Learning tips.";
    const result = findMatchesInText(text, "machine learning", {
      matchMode: "phrase",
    });

    expect(result.occurrenceCount).toBe(2);
    expect(result.matchQuote).toBe("Machine Learning");
    expect(result.occurrences[0].start).toBeGreaterThanOrEqual(0);
  });

  it("respects case-sensitive mode", () => {
    const text = "machine learning and Machine Learning and MACHINE LEARNING";
    const insensitive = findMatchesInText(text, "machine learning", {
      matchMode: "phrase",
      caseSensitive: false,
    });
    const sensitive = findMatchesInText(text, "machine learning", {
      matchMode: "phrase",
      caseSensitive: true,
    });

    expect(insensitive.occurrenceCount).toBe(3);
    expect(sensitive.occurrenceCount).toBe(1);
  });

  it("supports whole-word matching", () => {
    const text = "The cat scattered the catalog.";
    const result = findMatchesInText(text, "cat", {
      matchMode: "keyword",
      wholeWord: true,
    });

    expect(result.occurrenceCount).toBe(1);
    expect(result.matchQuote).toBe("cat");
  });

  it("supports prefix matching", () => {
    const text = "machine machinery machines";
    const result = findMatchesInText(text, "mach", {
      matchMode: "keyword",
      prefix: true,
    });

    expect(result.occurrenceCount).toBe(3);
  });

  it("requires all keywords on the page in keyword mode", () => {
    const text = "Machine learning enables prediction.";
    const hit = findMatchesInText(text, "machine prediction", {
      matchMode: "keyword",
    });
    const miss = findMatchesInText(text, "machine quantum", {
      matchMode: "keyword",
    });

    expect(hit.occurrenceCount).toBeGreaterThan(0);
    expect(miss.occurrenceCount).toBe(0);
  });

  it("builds a snippet around the first match", () => {
    const text =
      "AAAA BBBB Machine Learning is a subset of Artificial Intelligence CCCC DDDD";
    const match = findMatchesInText(text, "machine learning", {
      matchMode: "phrase",
    });
    const snippet = buildMatchSnippet(text, match.occurrences[0], 60);

    expect(snippet.toLowerCase()).toContain("machine learning");
  });

  it("builds highlight terms including the full phrase", () => {
    expect(
      buildHighlightTerms("machine learning", { matchMode: "phrase" })
    ).toContain("machine learning");
  });
});
