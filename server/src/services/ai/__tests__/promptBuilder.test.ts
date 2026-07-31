import { describe, expect, it } from "vitest";
import { buildAnswerMessages } from "../promptBuilder";

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
});
