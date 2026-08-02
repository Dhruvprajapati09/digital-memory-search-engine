import type { ChatSource } from '../types/chat'

export interface PreparedSource extends ChatSource {
  /** Sorted unique page numbers from all chunks of this document */
  pages: number[]
}

/**
 * Format page suffix for display: (p.12) or (p.12, p.45)
 */
export function formatSourcePages(pages: number[]): string {
  if (pages.length === 0) return ''
  return ` (p.${pages.join(', p.')})`
}

/**
 * Dedupe by documentId, keeping first occurrence (most relevant).
 * Merges page numbers from later chunks of the same document.
 */
export function prepareSources(sources: ChatSource[]): PreparedSource[] {
  const byKey = new Map<string, PreparedSource>()

  for (const source of sources) {
    const key = source.documentId || `${source.documentName}:${source.preview}`
    const existing = byKey.get(key)
    const page =
      typeof source.page === 'number' && Number.isFinite(source.page)
        ? source.page
        : undefined

    if (!existing) {
      byKey.set(key, {
        ...source,
        pages: page !== undefined ? [page] : [],
      })
      continue
    }

    if (page !== undefined && !existing.pages.includes(page)) {
      existing.pages = [...existing.pages, page].sort((a, b) => a - b)
      existing.page = existing.pages[0]
    }
  }

  return [...byKey.values()]
}
