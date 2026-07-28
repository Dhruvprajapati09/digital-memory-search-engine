import { describe, expect, it } from "vitest";
import { evaluateSearchBenchmark } from "../searchBenchmarkService";

describe("evaluateSearchBenchmark", () => {
  it("computes core search quality metrics", () => {
    const report = evaluateSearchBenchmark([
      {
        id: "case-1",
        query: "react auth",
        relevantChunkIds: ["a", "b"],
        retrievedChunkIds: ["a", "c", "b"],
        latencyMs: 100,
      },
      {
        id: "case-2",
        query: "mongodb index",
        relevantChunkIds: ["x"],
        retrievedChunkIds: ["z", "x"],
        latencyMs: 200,
      },
    ]);

    expect(report.cases).toBe(2);
    expect(report.recallAt5).toBe(1);
    expect(report.precisionAt5).toBeGreaterThan(0);
    expect(report.mrr).toBeGreaterThan(0);
    expect(report.ndcgAt10).toBeGreaterThan(0);
    expect(report.averageLatencyMs).toBe(150);
  });

  it("returns zeros for an empty benchmark", () => {
    expect(evaluateSearchBenchmark([]).cases).toBe(0);
    expect(evaluateSearchBenchmark([]).recallAt10).toBe(0);
  });
});
