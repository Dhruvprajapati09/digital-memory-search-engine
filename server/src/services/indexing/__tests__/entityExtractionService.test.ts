import { describe, expect, it, beforeAll } from "vitest";
import { env } from "../../../config/env";
import {
  extractEntitiesFromText,
  extractEntitiesFromChunks,
} from "../entityExtractionService";
import type { SemanticChunk } from "../../../types/documentIntelligence";

describe("indexing entityExtractionService", () => {
  beforeAll(() => {
    (env as { ENABLE_ENTITY_EXTRACTION_INDEX: boolean }).ENABLE_ENTITY_EXTRACTION_INDEX = true;
  });
  it("extracts tech entities from text", () => {
    const entities = extractEntitiesFromText(
      "This app uses React with Node.js and MongoDB for the backend."
    );

    const names = entities.map((e) => e.name);
    expect(names).toContain("React");
    expect(names).toContain("Node.js");
    expect(names).toContain("MongoDB");
  });

  it("extracts URLs and REST APIs", () => {
    const entities = extractEntitiesFromText(
      "See https://api.example.com and GET /api/users for details."
    );

    expect(entities.some((e) => e.type === "url")).toBe(true);
    expect(entities.some((e) => e.type === "rest_api")).toBe(true);
  });

  it("extracts code entities", () => {
    const entities = extractEntitiesFromText(
      "class UserService { function getUser() {} interface IUser {} }"
    );

    expect(entities.some((e) => e.type === "class" && e.name === "UserService")).toBe(true);
    expect(entities.some((e) => e.type === "function")).toBe(true);
    expect(entities.some((e) => e.type === "interface")).toBe(true);
  });

  it("enriches chunks with entities", () => {
    const chunks: SemanticChunk[] = [
      {
        chunkIndex: 0,
        text: "Express connects to MongoDB using Mongoose.",
        title: "Backend",
        topic: "Backend",
        sectionPath: ["Backend"],
        level: "topic",
        tokenCount: 10,
        contentPreview: "Express connects",
      },
    ];

    const enriched = extractEntitiesFromChunks(chunks);
    expect(enriched[0].entities?.length).toBeGreaterThan(0);
  });
});
