import { getSearchCacheStats } from "./searchCacheService";

export interface SearchV2AnalyticsEvent {
  userId: string;
  query: string;
  resultCount: number;
  latencyMs: number;
  cacheHit: boolean;
  graphUsed: boolean;
  strategy: string;
}

interface UserAnalyticsState {
  totalSearches: number;
  zeroResultQueries: Map<string, number>;
  queryCounts: Map<string, number>;
  strategyCounts: Map<string, number>;
  graphSearches: number;
  cacheHits: number;
  latencies: number[];
}

const analyticsByUser = new Map<string, UserAnalyticsState>();

function stateFor(userId: string): UserAnalyticsState {
  let state = analyticsByUser.get(userId);
  if (!state) {
    state = {
      totalSearches: 0,
      zeroResultQueries: new Map(),
      queryCounts: new Map(),
      strategyCounts: new Map(),
      graphSearches: 0,
      cacheHits: 0,
      latencies: [],
    };
    analyticsByUser.set(userId, state);
  }
  return state;
}

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function top(map: Map<string, number>, limit = 10): Array<{ value: string; count: number }> {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function recordSearchV2Analytics(event: SearchV2AnalyticsEvent): void {
  const state = stateFor(event.userId);
  state.totalSearches += 1;
  state.latencies.push(event.latencyMs);
  if (state.latencies.length > 500) state.latencies.shift();

  inc(state.queryCounts, event.query);
  inc(state.strategyCounts, event.strategy);

  if (event.resultCount === 0) inc(state.zeroResultQueries, event.query);
  if (event.cacheHit) state.cacheHits += 1;
  if (event.graphUsed) state.graphSearches += 1;
}

export function getSearchV2Dashboard(userId: string): {
  totalSearches: number;
  zeroResultQueries: Array<{ value: string; count: number }>;
  topSearches: Array<{ value: string; count: number }>;
  strategyUsage: Array<{ value: string; count: number }>;
  averageLatencyMs: number;
  cacheHitRate: number;
  graphUsageRate: number;
  cache: ReturnType<typeof getSearchCacheStats>;
} {
  const state = stateFor(userId);
  const total = state.totalSearches || 1;

  return {
    totalSearches: state.totalSearches,
    zeroResultQueries: top(state.zeroResultQueries),
    topSearches: top(state.queryCounts),
    strategyUsage: top(state.strategyCounts),
    averageLatencyMs: average(state.latencies),
    cacheHitRate: Math.round((state.cacheHits / total) * 1000) / 1000,
    graphUsageRate: Math.round((state.graphSearches / total) * 1000) / 1000,
    cache: getSearchCacheStats(),
  };
}

export function resetSearchV2Analytics(): void {
  analyticsByUser.clear();
}
