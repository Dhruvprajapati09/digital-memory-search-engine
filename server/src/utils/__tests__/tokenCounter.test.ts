import { describe, expect, it } from "vitest";
import {
  calculateTokens,
  calculateTokensFromWords,
} from "../../utils/tokenCounter";

describe("tokenCounter", () => {
  it("returns 0 for empty text", () => {
    expect(calculateTokens("")).toBe(0);
    expect(calculateTokens("   ")).toBe(0);
  });

  it("estimates tokens from character length", () => {
    expect(calculateTokens("hello")).toBe(2);
    expect(calculateTokens("a".repeat(400))).toBe(100);
  });

  it("estimates tokens from word count", () => {
    expect(calculateTokensFromWords(100)).toBe(130);
  });
});
