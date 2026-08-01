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
    expect(prompt).toContain("# Topic Name");
    expect(prompt).toContain(STYLE_BLOCKS.explanation);
    expect(prompt).toContain(LENGTH_BLOCKS.normal);
    expect(prompt).toContain(FORMAT_BLOCKS.paragraph);
  });

  it("requires H1 title and first-paragraph answer", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Always start with a single H1 title: "# Topic Name"');
    expect(prompt).toContain(
      "Answer the user's question immediately in the first paragraph after the H1"
    );
  });

  it("uses adaptive uppercase H2 sections and always ends with ## SOURCES", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("## HOW IT WORKS");
    expect(prompt).toContain("## WHY IT MATTERS");
    expect(prompt).toContain("## KEY POINTS");
    expect(prompt).toContain("## EXAMPLE");
    expect(prompt).toContain("## APPLICATIONS");
    expect(prompt).toContain("## KEY DIFFERENCES");
    expect(prompt).toContain("## STEPS");
    expect(prompt).toContain("omit unused ones");
    expect(prompt).toContain('Always end with a single "## SOURCES" section');
    expect(prompt).toContain("deduplicated");
  });

  it("uses teacher-like GFM formatting and citation rules", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain("Always cite which document");
    expect(prompt).not.toContain("ChatGPT");
    expect(prompt).not.toContain("NotebookLM");
    expect(prompt).toContain("Write like a teacher, not a document summarizer");
    expect(prompt).toContain("Never start with \"According to");
    expect(prompt).toContain(
      "Never mention filenames inside the explanation body"
    );
    expect(prompt).toContain("Synthesize information from all provided chunks");
    expect(prompt).toContain("do not repeat the same information");
    expect(prompt).toContain(
      "Selectively bold important concepts and technical terms only"
    );
    expect(prompt).toContain("never bold entire sentences");
    expect(prompt).toContain(
      "Leave one blank line between headings, paragraphs, lists, and code blocks"
    );
    expect(prompt).toContain("fenced code blocks");
    expect(prompt).toContain(
      "only when code exists in the retrieved context or the user explicitly asks for code"
    );
    expect(prompt).toContain("Never invent code");
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

  it("user prompt matches canonical GFM teacher-style rules", () => {
    const messages = buildAnswerMessages("What is X?", "Context about X");
    const user = messages[1].content;
    expect(user).toContain('# Topic Name');
    expect(user).toContain("first paragraph");
    expect(user).toContain("## HOW IT WORKS");
    expect(user).toContain("## KEY DIFFERENCES");
    expect(user).toContain("## STEPS");
    expect(user).toContain("## SOURCES");
    expect(user).toContain("Write like a teacher");
    expect(user).toContain('never use "Source 1"');
    expect(user).toContain("According to");
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
    expect(prompt).toContain("## KEY DIFFERENCES");
  });
});
