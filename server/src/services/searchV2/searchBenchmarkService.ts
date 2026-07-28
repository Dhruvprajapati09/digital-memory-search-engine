import type {
  SearchV2BenchmarkCase,
  SearchV2BenchmarkReport,
} from "../../types/searchV2";

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function recallAt(k: number, testCase: SearchV2BenchmarkCase): number {
  if (testCase.relevantChunkIds.length === 0) return 0;
  const retrieved = new Set(testCase.retrievedChunkIds.slice(0, k));
  const hits = testCase.relevantChunkIds.filter((id) => retrieved.has(id)).length;
  return hits / testCase.relevantChunkIds.length;
}

function precisionAt(k: number, testCase: SearchV2BenchmarkCase): number {
  const retrieved = testCase.retrievedChunkIds.slice(0, k);
  if (retrieved.length === 0) return 0;
  const relevant = new Set(testCase.relevantChunkIds);
  const hits = retrieved.filter((id) => relevant.has(id)).length;
  return hits / retrieved.length;
}

function reciprocalRank(testCase: SearchV2BenchmarkCase): number {
  const relevant = new Set(testCase.relevantChunkIds);
  const rank = testCase.retrievedChunkIds.findIndex((id) => relevant.has(id));
  return rank < 0 ? 0 : 1 / (rank + 1);
}

function dcgAt(k: number, testCase: SearchV2BenchmarkCase): number {
  const relevant = new Set(testCase.relevantChunkIds);
  return testCase.retrievedChunkIds.slice(0, k).reduce((sum, id, index) => {
    const gain = relevant.has(id) ? 1 : 0;
    return sum + gain / Math.log2(index + 2);
  }, 0);
}

function ndcgAt(k: number, testCase: SearchV2BenchmarkCase): number {
  const idealHits = Math.min(k, testCase.relevantChunkIds.length);
  if (idealHits === 0) return 0;

  let ideal = 0;
  for (let i = 0; i < idealHits; i += 1) {
    ideal += 1 / Math.log2(i + 2);
  }

  return dcgAt(k, testCase) / ideal;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function evaluateSearchBenchmark(
  cases: SearchV2BenchmarkCase[]
): SearchV2BenchmarkReport {
  if (cases.length === 0) {
    return {
      cases: 0,
      recallAt5: 0,
      recallAt10: 0,
      precisionAt5: 0,
      mrr: 0,
      ndcgAt10: 0,
      averageLatencyMs: 0,
    };
  }

  return {
    cases: cases.length,
    recallAt5: round(mean(cases.map((item) => recallAt(5, item)))),
    recallAt10: round(mean(cases.map((item) => recallAt(10, item)))),
    precisionAt5: round(mean(cases.map((item) => precisionAt(5, item)))),
    mrr: round(mean(cases.map(reciprocalRank))),
    ndcgAt10: round(mean(cases.map((item) => ndcgAt(10, item)))),
    averageLatencyMs: Math.round(mean(cases.map((item) => item.latencyMs ?? 0))),
  };
}
