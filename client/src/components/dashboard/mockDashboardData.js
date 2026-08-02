/**
 * Mock dashboard data used only where no backend endpoint exists.
 *
 * TODO: Replace MOCK_SEARCH_ACTIVITY with a daily search analytics API
 *       (e.g. GET /api/search/stats/daily?days=7) when available.
 *
 * TODO: Replace MOCK_RECENT_ACTIVITY with a unified activity feed API
 *       when available; until then activity may also be synthesized from
 *       documents + conversations in dashboardUtils.js.
 */

export const MOCK_SEARCH_ACTIVITY = [
  { day: 'Mon', count: 4 },
  { day: 'Tue', count: 7 },
  { day: 'Wed', count: 2 },
  { day: 'Thu', count: 9 },
  { day: 'Fri', count: 5 },
  { day: 'Sat', count: 3 },
  { day: 'Sun', count: 6 },
]

export const MOCK_RECENT_ACTIVITY = [
  {
    id: 'mock-1',
    type: 'uploaded',
    description: 'Uploaded "AI Research.pdf"',
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-2',
    type: 'asked',
    description: 'Asked "What is RAG?"',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-3',
    type: 'indexed',
    description: 'Indexed "Java Notes.pdf"',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-4',
    type: 'deleted',
    description: 'Deleted "Old Resume.pdf"',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
]
