import { describe, expect, it } from "vitest";
import { analyzeLayout } from "../layoutAnalysisService";

describe("layoutAnalysisService", () => {
  it("detects markdown headings and code blocks", () => {
    const text = `# Title

## Section One

Some paragraph text here.

\`\`\`typescript
class App {}
\`\`\`

- List item one
- List item two
`;

    const blocks = analyzeLayout(text);

    expect(blocks.some((b) => b.type === "title")).toBe(true);
    expect(blocks.some((b) => b.type === "heading")).toBe(true);
    expect(blocks.some((b) => b.type === "code_block")).toBe(true);
    expect(blocks.some((b) => b.type === "list")).toBe(true);
    expect(blocks.some((b) => b.type === "paragraph")).toBe(true);
  });

  it("detects markdown tables when table analysis enabled", () => {
    const text = `| Name | Value |
| --- | --- |
| React | Framework |
| MongoDB | Database |`;

    const blocks = analyzeLayout(text);
    expect(blocks.some((b) => b.type === "table")).toBe(true);
  });
});
