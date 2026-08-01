import type { ChatSource } from '../types/chat'

/**
 * Dedupe by documentId, keeping first occurrence (most relevant).
 * Preserves original array order as relevance ranking.
 */
export function prepareSources(sources: ChatSource[]): ChatSource[] {
  const seen = new Set<string>()
  const result: ChatSource[] = []

  for (const source of sources) {
    const key = source.documentId || `${source.documentName}:${source.preview}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(source)
  }

  return result
}
