import { describe, expect, it } from "vitest";
import { buildAnswerMessages, buildSystemPrompt } from "../promptBuilder";
import {
  FORMAT_BLOCKS,
  GROUNDING_BLOCK,
  LENGTH_BLOCKS,
  STYLE_BLOCKS,
} from "../responseInstructionBlocks";
import type { ResponsePlan } from "../responsePlan";

describe("buildAnswerMessages", () => {
  it("builds system + user messages without prior turns", () => {
    const messages = buildAnswerMessages("What is X?", "Context about X");

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("What is X?");
    expect(messages[1].content).toContain("Context about X");
  });

  it("inserts prior turns between system and final user prompt", () => {
    const messages = buildAnswerMessages("Follow-up?", "More context", [
      { role: "user", content: "First question" },
      { role: "assistant", content: "First answer" },
    ]);

    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe("system");
    expect(messages[1]).toEqual({ role: "user", content: "First question" });
    expect(messages[2]).toEqual({
      role: "assistant",
      content: "First answer",
    });
    expect(messages[3].role).toBe("user");
    expect(messages[3].content).toContain("Follow-up?");
  });

  it("skips empty prior message content", () => {
    const messages = buildAnswerMessages("Q?", "C", [
      { role: "user", content: "   " },
      { role: "assistant", content: "Kept" },
    ]);

    expect(messages).toHaveLength(3);
    expect(messages[1]).toEqual({ role: "assistant", content: "Kept" });
  });

  it("composes system prompt from plan blocks", () => {
    const plan: ResponsePlan = {
      styles: ["example", "explanation", "simple"],
      length: "short",
      format: "paragraph",
    };
    const messages = buildAnswerMessages("Q", "C", undefined, plan);
    const system = messages[0].content;

    expect(system).toContain(GROUNDING_BLOCK.slice(0, 40));
    expect(system).toContain(STYLE_BLOCKS.explanation);
    expect(system).toContain(STYLE_BLOCKS.simple);
    expect(system).toContain(STYLE_BLOCKS.example);
    expect(system).toContain(LENGTH_BLOCKS.short);
    expect(system).toContain(FORMAT_BLOCKS.paragraph);
  });
});

describe("buildSystemPrompt", () => {
  it("includes grounding and default explanation blocks", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Answer ONLY using the provided context");
    expect(prompt).toContain('Never use numeric labels like "Source 1"');
    expect(prompt).toContain("Answer the user's question directly first");
    expect(prompt).toContain(STYLE_BLOCKS.explanation);
    expect(prompt).toContain(LENGTH_BLOCKS.normal);
    expect(prompt).toContain(FORMAT_BLOCKS.paragraph);
  });

  it("uses teacher-like teach-first citation and synthesis rules", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain("Always cite which document");
    expect(prompt).not.toContain("ChatGPT");
    expect(prompt).not.toContain("NotebookLM");
    expect(prompt).toContain("natural, teacher-like style");
    expect(prompt).toContain("Never start with \"According to");
    expect(prompt).toContain("Never mention filenames inside the explanation body");
    expect(prompt).toContain("Sources section");
    expect(prompt).toContain("deduplicated");
    expect(prompt).toContain("Synthesize information");
    expect(prompt).toContain("Do not copy document sentences verbatim");
    expect(prompt).toContain("do not repeat the same information");
  });

  it("uses intent-adaptive opening and minimal structure", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("For concept questions");
    expect(prompt).toContain("do not force a definition");
    expect(prompt).toContain("Choose the smallest structure needed");
    expect(prompt).toContain("Do not force optional sections");
    expect(prompt).toContain("Prefer short paragraphs");
    expect(prompt).toContain("Use bullets only when they help scanability");
    expect(prompt).toContain("Use tables only for comparisons");
    expect(prompt).toContain("Use code blocks only for actual code");
    expect(prompt).toContain(
      "genuinely help explain the concept"
    );
    expect(prompt).toContain("concise by default");
    expect(prompt).toContain("do not pretend the answer is complete");
    expect(prompt).not.toContain("Title →");
  });

  it("does not instruct the LLM to emit the canned no-answer message", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain(
      "I couldn't find that information in your saved documents."
    );
    expect(prompt).toContain('Do not use a canned "not found" reply');
  });

  it("does not allow inline filename exceptions in the body", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain("when documents conflict");
    expect(prompt).not.toContain("Mention a filename inline");
  });

  it("user prompt matches teacher-style direct-answer rules", () => {
    const messages = buildAnswerMessages("What is X?", "Context about X");
    const user = messages[1].content;
    expect(user).toContain('Never use numeric labels like "Source 1"');
    expect(user).toContain("Answer the question directly first");
    expect(user).toContain("teacher-like style");
    expect(user).toContain("smallest useful structure");
    expect(user).toContain("Sources section at the end");
    expect(user).toContain("do not pretend completeness");
    expect(user).toContain("Concise by default");
    expect(user).not.toContain(
      "Cite using the document filenames from the context labels"
    );
  });

  it("includes comparison and table blocks for comparison plans", () => {
    const prompt = buildSystemPrompt({
      styles: ["comparison"],
      length: "short",
      format: "table",
    });
    expect(prompt).toContain(STYLE_BLOCKS.comparison);
    expect(prompt).toContain(LENGTH_BLOCKS.short);
    expect(prompt).toContain(FORMAT_BLOCKS.table);
  });
});
