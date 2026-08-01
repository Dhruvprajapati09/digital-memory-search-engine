import { describe, expect, it } from "vitest";
import { normalizeQueryText } from "../queryNormalizer";
import { extractKeywords } from "../keywordExtractionService";
import {
  buildContentFocusedRetrievalTerms,
  buildRetrievalQuery,
} from "../queryPipeline";
import {
  filterInstructionTerms,
  stripAnswerStylePhrases,
} from "../answerStyleTerms";
import type { QueryPipelineResult } from "../../../types/query";
import { detectResponsePlan } from "../../ai/responsePlan";

function pipelineStub(
  partial: Partial<QueryPipelineResult> &
    Pick<QueryPipelineResult, "original" | "normalized" | "keywords">
): QueryPipelineResult {
  return {
    intent: "search",
    confidence: 1,
    entities: [],
    expandedTerms: partial.expandedTerms ?? partial.keywords ?? [],
    metadataHints: {},
    ...partial,
  };
}

function termsForQuestion(question: string): ReturnType<
  typeof buildContentFocusedRetrievalTerms
> {
  const { original, normalized } = normalizeQueryText(question);
  const keywords = extractKeywords(normalized);
  return buildContentFocusedRetrievalTerms(
    pipelineStub({
      original,
      normalized,
      keywords,
      expandedTerms: keywords,
    })
  );
}

describe("answerStyleTerms", () => {
  it("strips multi-word instruction phrases", () => {
    expect(
      stripAnswerStylePhrases("explain markov model in simple language")
    ).toBe("explain markov model");
  });

  it("filters instruction tokens with order-preserving dedupe", () => {
    expect(
      filterInstructionTerms([
        "markov",
        "example",
        "model",
        "Markov",
        "compare",
      ])
    ).toEqual(["markov", "model"]);
  });
});

describe("buildContentFocusedRetrievalTerms", () => {
  it("matches bare Markov Model for explain / example / simple variants", () => {
    const bare = termsForQuestion("Markov Model");
    const styled = [
      "Explain Markov Model",
      "Explain Markov Model with an example",
      "Explain Markov Model in simple language",
      "What is Markov Model?",
      "Define Markov Model",
    ];

    for (const question of styled) {
      const terms = termsForQuestion(question);
      expect(terms.retrievalQuery).toBe(bare.retrievalQuery);
      expect(terms.keywords).toEqual(bare.keywords);
      expect(terms.retrievalQuery).not.toMatch(
        /\b(example|simple|language|compare|explain|define)\b/
      );
    }
  });

  it("keeps content entities for compare queries without compare token", () => {
    const terms = termsForQuestion(
      "Compare Markov Model and Hidden Markov Model"
    );
    expect(terms.keywords).toEqual(
      expect.arrayContaining(["markov", "model", "hidden"])
    );
    expect(terms.keywords).not.toContain("compare");
    expect(terms.retrievalQuery).not.toMatch(/\bcompare\b/);

    const bareHidden = termsForQuestion("Hidden Markov Model");
    // Same content bag (order may place hidden first or after)
    expect(new Set(terms.keywords)).toEqual(new Set(bareHidden.keywords));
  });

  it("strips list/application instruction words", () => {
    const terms = termsForQuestion("List applications of Markov Model");
    expect(terms.keywords).toEqual(
      expect.arrayContaining(["markov", "model"])
    );
    expect(terms.keywords).not.toContain("list");
    expect(terms.keywords).not.toContain("application");
    expect(terms.retrievalQuery).toBe(
      termsForQuestion("Markov Model").retrievalQuery
    );
  });

  it("never returns an empty retrieval query", () => {
    const terms = buildContentFocusedRetrievalTerms(
      pipelineStub({
        original: "explain simply",
        normalized: "explain simply",
        keywords: ["explain", "simply"],
        expandedTerms: ["explain", "simply"],
      })
    );
    expect(terms.retrievalQuery.trim().length).toBeGreaterThan(0);
  });

  it("preserves real multi-word entities", () => {
    const terms = buildContentFocusedRetrievalTerms(
      pipelineStub({
        original: "Explain Markov Model",
        normalized: "explain markov model",
        keywords: ["markov", "model"],
        entities: ["Markov Model", "example"],
      })
    );
    expect(terms.entities).toContain("Markov Model");
    expect(terms.entities).not.toContain("example");
  });
});

describe("buildRetrievalQuery", () => {
  it("maps NL questions to content keywords", () => {
    const q = buildRetrievalQuery(
      pipelineStub({
        original: "What is Markov Model?",
        normalized: "what is markov model?",
        keywords: extractKeywords("what is markov model?"),
      })
    );
    expect(q).toContain("markov");
    expect(q).toContain("model");
    expect(q).not.toContain("what");
    expect(q).not.toContain("?");
  });

  it("never returns empty — falls back", () => {
    const q = buildRetrievalQuery(
      pipelineStub({
        original: "???",
        normalized: "",
        keywords: [],
      })
    );
    expect(q.trim().length).toBeGreaterThan(0);
  });
});

describe("ResponsePlan still uses original question", () => {
  it("detects styles even when retrieval strips the same cues", () => {
    expect(
      detectResponsePlan("Explain Markov Model in simple language").styles
    ).toEqual(["explanation", "simple"]);
    expect(
      detectResponsePlan("Give an example of Markov Model").styles
    ).toContain("example");
    expect(
      detectResponsePlan("Compare Markov Model and Hidden Markov Model").styles
    ).toEqual(["comparison"]);
  });
});
