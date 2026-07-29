import { describe, expect, it } from "vitest";
import {
  extractRelationshipsFromText,
  extractRelationshipsFromChunks,
} from "../relationshipExtractionService";
import type { SemanticChunk } from "../../../types/documentIntelligence";

describe("relationshipExtractionService", () => {
  it("extracts USES relationships from known patterns", () => {
    const relationships = extractRelationshipsFromText(
      "Our frontend is built with React and the backend runs on Node.js."
    );

    expect(
      relationships.some(
        (r) => r.type === "USES" && r.source === "React" && r.target === "Node.js"
      )
    ).toBe(true);
  });

  it("extracts CONNECTS_TO relationships", () => {
    const relationships = extractRelationshipsFromText(
      "MongoDB connects to Express in our API layer."
    );

    expect(
      relationships.some((r) => r.type === "CONNECTS_TO")
    ).toBe(true);
  });

  it("extracts with/using patterns", () => {
    const relationships = extractRelationshipsFromText(
      "Authentication works with JWT tokens."
    );

    expect(relationships.some((r) => r.type === "USES")).toBe(true);
  });

  it("enriches chunks with relationships", () => {
    const chunks: SemanticChunk[] = [
      {
        chunkIndex: 0,
        text: "React uses Node.js for server-side rendering.",
        title: "Architecture",
        topic: "Architecture",
        sectionPath: ["Architecture"],
        level: "topic",
        tokenCount: 10,
        contentPreview: "React uses",
        entities: [
          { name: "React", type: "framework" },
          { name: "Node.js", type: "framework" },
        ],
      },
    ];

    const enriched = extractRelationshipsFromChunks(chunks);
    expect(enriched[0].relationships?.length).toBeGreaterThan(0);
  });
});
