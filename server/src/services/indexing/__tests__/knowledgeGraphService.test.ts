import { describe, expect, it } from "vitest";
import { buildKnowledgeGraphData } from "../knowledgeGraphService";
import type { SemanticChunk } from "../../../types/documentIntelligence";

describe("knowledgeGraphService", () => {
  it("builds document, topic, section, and entity nodes", () => {
    const chunks: SemanticChunk[] = [
      {
        chunkIndex: 0,
        text: "React hooks overview.",
        title: "Hooks",
        topic: "Hooks",
        section: "Hooks",
        chapter: "React Notes",
        sectionPath: ["Hooks"],
        level: "topic",
        tokenCount: 5,
        contentPreview: "React hooks",
      },
    ];

    const entities = [
      { name: "React", type: "framework" as const },
      { name: "Node.js", type: "framework" as const },
    ];

    const relationships = [
      { source: "React", target: "Node.js", type: "USES" },
    ];

    const { nodes, edges } = buildKnowledgeGraphData(
      "doc-1",
      "user-1",
      "React Notes",
      chunks,
      entities,
      relationships
    );

    expect(nodes.some((n) => n.type === "document")).toBe(true);
    expect(nodes.some((n) => n.type === "topic")).toBe(true);
    expect(nodes.some((n) => n.type === "entity" && n.label === "React")).toBe(true);
    expect(edges.some((e) => e.type === "CONTAINS")).toBe(true);
    expect(edges.some((e) => e.type === "USES")).toBe(true);
  });
});
