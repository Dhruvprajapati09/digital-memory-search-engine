import { describe, expect, it, vi } from "vitest";

vi.mock("../../query/vocabularyLoader", () => ({
  loadUserVocabulary: vi.fn(async () => ({
    keywords: new Set<string>(),
    concepts: new Set<string>(),
    tags: new Set<string>(),
    documentTitles: new Set<string>(),
  })),
}));

import { rewriteSearchQuery } from "../queryRewriteService";

describe("rewriteSearchQuery", () => {
  it("expands abbreviated technical queries", async () => {
    const result = await rewriteSearchQuery("jwt auth", "user-1");

    expect(result.correctedQuery).toContain("jwt authentication");
    expect(result.rewrittenQuery).toContain("json web token");
    expect(result.expansions).toContain("authorization");
  });

  it("corrects common technical misspellings", async () => {
    const result = await rewriteSearchQuery("authentcation middleware", "user-1");

    expect(result.correctedQuery).toContain("authentication");
    expect(result.corrections).toContainEqual({
      from: "authentcation",
      to: "authentication",
    });
  });
});
