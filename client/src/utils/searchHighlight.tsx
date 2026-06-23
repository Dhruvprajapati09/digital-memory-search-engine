import type { ReactNode } from 'react'

/**
 * Wraps matching query terms in <mark> for search result previews.
 * Case-insensitive; preserves original text casing.
 */
export function highlightText(
  text: string,
  terms: string[],
): ReactNode[] {
  if (!terms.length || !text) {
    return [text]
  }

  const uniqueTerms = [
    ...new Set(terms.filter((term) => term.length >= 2)),
  ].sort((a, b) => b.length - a.length)

  if (!uniqueTerms.length) {
    return [text]
  }

  const pattern = new RegExp(
    `(${uniqueTerms.map(escapeRegExp).join('|')})`,
    'gi',
  )

  const parts = text.split(pattern)

  return parts.map((part, index) => {
    const isMatch = uniqueTerms.some(
      (term) => part.toLowerCase() === term.toLowerCase(),
    )

    if (isMatch) {
      return (
        <mark
          key={`${part}-${index}`}
          className="bg-amber-100 text-amber-900 rounded px-0.5"
        >
          {part}
        </mark>
      )
    }

    return part
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function formatMatchScore(score: number): string {
  return `${Math.round(score * 100)}% Match`
}

export function formatDocumentType(type: string): string {
  if (type === 'pdf') return 'PDF'
  if (type === 'image') return 'Image'
  if (type === 'note') return 'Note'
  return type
}
