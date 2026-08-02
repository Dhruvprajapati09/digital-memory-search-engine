import { describe, expect, it } from "vitest";
import { detectResponsePlan } from "../responsePlan";

describe("detectResponsePlan", () => {
  it("defaults bare keywords to explanation / normal / paragraph", () => {
    const plan = detectResponsePlan("Markov Model");
    expect(plan).toEqual({
      styles: ["explanation"],
      length: "normal",
      format: "paragraph",
    });
  });

  it("maps Define to definition", () => {
    const plan = detectResponsePlan("Define Markov Model");
    expect(plan.styles).toEqual(["definition"]);
    expect(plan.format).toBe("paragraph");
  });

  it("maps What is to explanation (not definition)", () => {
    const plan = detectResponsePlan("What is Markov Model?");
    expect(plan.styles).toEqual(["explanation"]);
  });

  it("maps Explain simply to explanation + simple", () => {
    const plan = detectResponsePlan(
      "Explain Markov Model in simple language"
    );
    expect(plan.styles).toEqual(["explanation", "simple"]);
  });

  it("combines multiple styles: explain + simple + example", () => {
    const plan = detectResponsePlan(
      "Explain Markov Model in simple language and give an example"
    );
    expect(plan.styles).toEqual(["example", "explanation", "simple"]);
    expect(plan.length).toBe("normal");
    expect(plan.format).toBe("paragraph");
  });

  it("maps Give an example to example style", () => {
    const plan = detectResponsePlan("Give an example of Markov Model");
    expect(plan.styles).toContain("example");
  });

  it("maps Compare to comparison with implicit table format", () => {
    const plan = detectResponsePlan(
      "Compare Markov Model and Hidden Markov Model"
    );
    expect(plan.styles).toEqual(["comparison"]);
    expect(plan.format).toBe("table");
  });

  it("detects short length independently", () => {
    const plan = detectResponsePlan(
      "Compare Markov Model and Hidden Markov Model briefly"
    );
    expect(plan.styles).toEqual(["comparison"]);
    expect(plan.length).toBe("short");
    expect(plan.format).toBe("table");
  });

  it("prefers detailed when both short and detailed cues appear", () => {
    const plan = detectResponsePlan(
      "Briefly explain Markov Model in detail"
    );
    expect(plan.length).toBe("detailed");
  });

  it("maps procedure with implicit steps format", () => {
    const plan = detectResponsePlan("How does Markov Model work?");
    expect(plan.styles).toContain("procedure");
    expect(plan.format).toBe("steps");
  });

  it("maps list advantages to list style and list format", () => {
    const plan = detectResponsePlan("List advantages of Markov Model");
    expect(plan.styles).toContain("list");
    expect(plan.format).toBe("list");
  });

  it("maps summarize to summary", () => {
    const plan = detectResponsePlan("Summarize Markov Model");
    expect(plan.styles).toEqual(["summary"]);
  });

  it("lets explicit format override implicit style format", () => {
    const plan = detectResponsePlan(
      "Compare Markov Model and HMM as a list"
    );
    expect(plan.styles).toContain("comparison");
    expect(plan.format).toBe("list");
  });

  it("uses simple alone as explanation + simple", () => {
    const plan = detectResponsePlan("Markov Model in plain english");
    expect(plan.styles).toEqual(["explanation", "simple"]);
  });

  it("detects detailed length", () => {
    const plan = detectResponsePlan("Explain Markov Model in detail");
    expect(plan.styles).toContain("explanation");
    expect(plan.length).toBe("detailed");
  });
});
