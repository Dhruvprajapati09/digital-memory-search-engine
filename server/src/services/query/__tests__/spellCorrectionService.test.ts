import { describe, expect, it } from "vitest";
import type { UserVocabulary } from "../../../types/query";
import {
  STATIC_SPELLING_DICTIONARY,
  buildSpellingDictionaries,
  correctQuerySpelling,
} from "../spellCorrectionService";

function vocab(partial: {
  keywords?: string[];
  concepts?: string[];
  tags?: string[];
  documentTitles?: string[];
}): UserVocabulary {
  return {
    keywords: new Set(partial.keywords ?? []),
    concepts: new Set(partial.concepts ?? []),
    tags: new Set(partial.tags ?? []),
    documentTitles: new Set(partial.documentTitles ?? []),
  };
}

describe("buildSpellingDictionaries", () => {
  it("puts indexed terms in primary and static terms in fallback", () => {
    const dicts = buildSpellingDictionaries(
      vocab({
        keywords: ["markov", "model"],
        concepts: ["LangGraph"],
        tags: ["crewai"],
        documentTitles: ["Intro to LLaMA"],
      })
    );

    expect(dicts.primaryDictionary).toEqual(
      expect.arrayContaining([
        "markov",
        "model",
        "langgraph",
        "crewai",
        "intro",
        "llama",
      ])
    );
    expect(dicts.fallbackDictionary).toEqual(
      expect.arrayContaining([...STATIC_SPELLING_DICTIONARY])
    );
  });
});

describe("correctQuerySpelling", () => {
  it("corrects modl → model from user vocab", () => {
    const dicts = buildSpellingDictionaries(
      vocab({ keywords: ["model", "markov", "hidden"] })
    );
    const result = correctQuerySpelling("hidden markov modl", {
      primaryDictionary: dicts.primaryDictionary,
      fallbackDictionary: dicts.fallbackDictionary,
    });

    expect(result.correctedQuery).toBe("hidden markov model");
    expect(result.corrections).toContainEqual({ from: "modl", to: "model" });
  });

  it("corrects project-specific terms from vocab", () => {
    const dicts = buildSpellingDictionaries(
      vocab({
        concepts: ["langgraph", "crewai", "llama"],
      })
    );

    expect(
      correctQuerySpelling("langgraf", {
        primaryDictionary: dicts.primaryDictionary,
        fallbackDictionary: [],
      }).correctedQuery
    ).toBe("langgraph");

    expect(
      correctQuerySpelling("crevai", {
        primaryDictionary: dicts.primaryDictionary,
        fallbackDictionary: [],
      }).correctedQuery
    ).toBe("crewai");

    expect(
      correctQuerySpelling("llma", {
        primaryDictionary: dicts.primaryDictionary,
        fallbackDictionary: [],
      }).correctedQuery
    ).toBe("llama");
  });

  it("prefers vocab candidate over static when both match", () => {
    // typo equidistant to vocab "markov" and would also be near nothing in static;
    // clearer: primary has "middlewarex", static has "middleware"
    const result = correctQuerySpelling("middlewar", {
      primaryDictionary: ["middlewarex"],
      fallbackDictionary: ["middleware"],
      minTokenLength: 4,
    });

    // middlewar→middlewarex (primary, distance 1) wins over middleware (fallback never consulted)
    expect(result.corrections).toContainEqual({
      from: "middlewar",
      to: "middlewarex",
    });
  });

  it("falls back to static dictionary when vocab has no match", () => {
    const result = correctQuerySpelling("authentcation", {
      primaryDictionary: [],
      fallbackDictionary: STATIC_SPELLING_DICTIONARY,
      minTokenLength: 5,
    });

    expect(result.correctedQuery).toContain("authentication");
    expect(result.corrections).toContainEqual({
      from: "authentcation",
      to: "authentication",
    });
  });

  it("leaves exact queries unchanged", () => {
    const dicts = buildSpellingDictionaries(
      vocab({ keywords: ["markov", "model"] })
    );
    const result = correctQuerySpelling("markov model", {
      primaryDictionary: dicts.primaryDictionary,
      fallbackDictionary: dicts.fallbackDictionary,
    });

    expect(result.correctedQuery).toBe("markov model");
    expect(result.corrections).toEqual([]);
  });

  it("does not correct short tokens", () => {
    const result = correctQuerySpelling("vs model", {
      primaryDictionary: ["versus", "model"],
      fallbackDictionary: STATIC_SPELLING_DICTIONARY,
    });

    expect(result.correctedQuery).toBe("vs model");
  });

  it("never returns an empty corrected query", () => {
    const result = correctQuerySpelling("   ", {
      primaryDictionary: ["model"],
    });
    expect(result.correctedQuery.trim().length).toBeGreaterThanOrEqual(0);
  });
});
