import type { Document, DocumentType } from '../types/document'

export type MemoryFilter =
  | 'all'
  | 'pdf'
  | 'docx'
  | 'txt'
  | 'images'
  | 'website'
  | 'youtube'

export type MemorySort =
  | 'newest'
  | 'oldest'
  | 'name-asc'
  | 'name-desc'
  | 'size-desc'
  | 'size-asc'

const FAVORITES_KEY = 'memories.favorites'

export function getTypeBadge(type: DocumentType): string {
  switch (type) {
    case 'pdf':
      return 'PDF'
    case 'note':
      return 'TXT'
    case 'image':
      return 'IMG'
    case 'video':
      return 'VID'
    default:
      return 'FILE'
  }
}

export function getTypeLabel(type: DocumentType): string {
  switch (type) {
    case 'pdf':
      return 'PDF'
    case 'note':
      return 'TXT'
    case 'image':
      return 'Image'
    case 'video':
      return 'YouTube'
    default:
      return 'File'
  }
}

export function formatFileSize(bytes?: number): string | null {
  if (bytes == null || bytes < 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatRelativeUploadDate(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (diffDays === 0) return 'Uploaded today'
  if (diffDays === 1) return 'Uploaded yesterday'
  if (diffDays > 1 && diffDays < 30) return `Uploaded ${diffDays} days ago`

  return `Uploaded ${date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })}`
}

export function getStatusLabel(document: Document): string | null {
  const indexStatus = document.indexStatus ?? 'pending'
  const extractionStatus =
    document.status ?? document.extractionStatus ?? 'pending'

  if (indexStatus === 'indexed') return 'AI Summary Ready'
  if (indexStatus === 'failed' || extractionStatus === 'failed') return 'Failed'
  if (
    indexStatus === 'processing' ||
    extractionStatus === 'processing' ||
    extractionStatus === 'pending' ||
    indexStatus === 'pending'
  ) {
    if (extractionStatus === 'completed' && indexStatus === 'pending') {
      return 'Ready'
    }
    return 'Processing'
  }

  return 'Ready'
}

export function buildMetaSegments(document: Document): string[] {
  const segments: string[] = []

  if (document.totalPages && document.totalPages > 0) {
    segments.push(
      `${document.totalPages} ${document.totalPages === 1 ? 'page' : 'pages'}`,
    )
  }

  segments.push(getTypeLabel(document.type))

  const size = formatFileSize(document.fileSize)
  if (size) segments.push(size)

  const status = getStatusLabel(document)
  if (status && status !== 'Ready') segments.push(status)

  return segments
}

export function getDisplayName(document: Document): string {
  return document.title || document.originalFileName || 'Untitled'
}

export function matchesSearch(document: Document, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const title = document.title?.toLowerCase() ?? ''
  const original = document.originalFileName?.toLowerCase() ?? ''
  return title.includes(q) || original.includes(q)
}

export function matchesFilter(
  document: Document,
  filter: MemoryFilter,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'pdf':
      return document.type === 'pdf'
    case 'txt':
      return document.type === 'note'
    case 'images':
      return document.type === 'image'
    case 'youtube':
      return document.type === 'video'
    case 'docx':
    case 'website':
      return false
    default:
      return true
  }
}

export function sortDocuments(
  documents: Document[],
  sort: MemorySort,
): Document[] {
  const sorted = [...documents]

  sorted.sort((a, b) => {
    switch (sort) {
      case 'newest':
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      case 'oldest':
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      case 'name-asc':
        return getDisplayName(a).localeCompare(getDisplayName(b), undefined, {
          sensitivity: 'base',
        })
      case 'name-desc':
        return getDisplayName(b).localeCompare(getDisplayName(a), undefined, {
          sensitivity: 'base',
        })
      case 'size-desc':
        return (b.fileSize ?? 0) - (a.fileSize ?? 0)
      case 'size-asc':
        return (a.fileSize ?? 0) - (b.fileSize ?? 0)
      default:
        return 0
    }
  })

  return sorted
}

export function filterAndSortDocuments(
  documents: Document[],
  query: string,
  filter: MemoryFilter,
  sort: MemorySort,
): Document[] {
  const filtered = documents.filter(
    (doc) => matchesSearch(doc, query) && matchesFilter(doc, filter),
  )
  return sortDocuments(filtered, sort)
}

export function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

export function saveFavorites(ids: Set<string>): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]))
}

export const FILTER_OPTIONS: Array<{ value: MemoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
  { value: 'txt', label: 'TXT' },
  { value: 'images', label: 'Images' },
  { value: 'website', label: 'Website' },
  { value: 'youtube', label: 'YouTube' },
]

export const SORT_OPTIONS: Array<{ value: MemorySort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'size-desc', label: 'Largest Size' },
  { value: 'size-asc', label: 'Smallest Size' },
]
