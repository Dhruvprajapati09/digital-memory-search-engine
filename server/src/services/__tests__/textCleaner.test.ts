import { describe, expect, it } from "vitest";
import {
  cleanText,
  removeExtraSpaces,
  removeRepeatedNewLines,
  normalizeUnicode,
  repairWrappedLines,
} from "../textCleaner";

describe("textCleaner", () => {
  it("removeExtraSpaces collapses horizontal whitespace", () => {
    expect(removeExtraSpaces("Hello     World")).toBe("Hello World");
  });

  it("removeRepeatedNewLines limits blank lines", () => {
    expect(removeRepeatedNewLines("Line 1\n\n\n\nLine 2")).toBe(
      "Line 1\n\nLine 2"
    );
  });

  it("normalizeUnicode normalizes compatibility characters", () => {
    expect(normalizeUnicode("ﬁ")).toBe("fi");
  });

  it("cleanText normalizes OCR-style noisy text", () => {
    const input = "Hello     World\n\n\nThis is    OCR";
    expect(cleanText(input)).toBe("Hello World\n\nThis is OCR");
  });

  it("cleanText trims leading and trailing whitespace", () => {
    expect(cleanText("  hello  ")).toBe("hello");
  });

  it("repairWrappedLines merges wrapped prose but preserves lists", () => {
    const input = [
      "Digital Memory Search Engine is an AI-powered",
      "platform for semantic search.",
      "",
      "Advantages",
      "- Fast retrieval",
      "- Source citations",
    ].join("\n");

    expect(repairWrappedLines(input)).toContain(
      "Digital Memory Search Engine is an AI-powered platform"
    );
    expect(repairWrappedLines(input)).toContain("- Fast retrieval\n- Source citations");
  });
});
