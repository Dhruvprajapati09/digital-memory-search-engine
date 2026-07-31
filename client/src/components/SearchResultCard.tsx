import { Link } from 'react-router-dom'
import Card from './ui/Card'
import Badge from './ui/Badge'
import type { SearchResult } from '../types/search'
import {
  highlightText,
  formatDocumentType,
  formatOccurrenceCount,
} from '../utils/searchHighlight'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const API_ORIGIN = API_BASE.replace(/\/api$/, '')

interface SearchResultCardProps {
  result: SearchResult
}

function resolveFileUrl(fileUrl?: string): string | null {
  if (!fileUrl) return null
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl
  return `${API_ORIGIN}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`
}

/** Open original PDF, jumping to bestMatchPage when available. */
function buildOpenUrl(result: SearchResult): string | null {
  const fileUrl = resolveFileUrl(result.fileUrl)
  if (!fileUrl) return null

  if (result.type === 'pdf') {
    const page = result.bestMatchPage
    return page ? `${fileUrl}#page=${page}` : fileUrl
  }

  return fileUrl
}

function FileIcon() {
  return (
    <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 21h10a2 2 0 002-2V9.5L13.5 4H7a2 2 0 00-2 2v13a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 4v5h5" />
    </svg>
  )
}

function OpenIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 7v12h12" />
    </svg>
  )
}

function SearchResultCard({ result }: SearchResultCardProps) {
  const createdDate = new Date(result.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const displayName = result.documentName ?? result.originalFileName ?? result.title
  const openUrl = buildOpenUrl(result)
  const isVideo = result.type === 'video'
  const matchingPages = result.matchingPages ?? []
  const otherPages = matchingPages.filter((page) => page !== result.bestMatchPage)
  const occurrences = result.occurrenceCount ?? 0
  const externalVideoUrl =
    result.videoUrl ??
    (result.youtubeVideoId && result.timestampSeconds !== undefined
      ? `https://www.youtube.com/watch?v=${result.youtubeVideoId}&t=${result.timestampSeconds}s`
      : result.youtubeVideoId
        ? `https://www.youtube.com/watch?v=${result.youtubeVideoId}`
        : undefined)

  return (
    <Card className="hover:border-primary-200 transition-colors">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3 min-w-0">
          {isVideo && result.thumbnail ? (
            <img
              src={result.thumbnail}
              alt=""
              className="w-20 h-14 object-cover rounded-lg shrink-0"
            />
          ) : (
            <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background">
              <FileIcon />
            </div>
          )}

          <div className="min-w-0">
            {isVideo && externalVideoUrl ? (
              <a
                href={externalVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-text hover:text-primary-600"
              >
                {displayName}
              </a>
            ) : (
              <Link
                to={`/dashboard/documents/${result.documentId}`}
                className="text-lg font-semibold text-text hover:text-primary-600"
              >
                {displayName}
              </Link>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span>{formatDocumentType(result.type)}</span>
              {result.exactMatch && <span>Exact match</span>}
              {result.channel && <span>{result.channel}</span>}
              <span>{createdDate}</span>
            </div>
          </div>
        </div>

        <Badge variant="success">{formatOccurrenceCount(occurrences)}</Badge>
      </div>

      {result.bestMatchPage != null && (
        <div className="mt-4 space-y-1 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Page
          </p>
          <p className="text-text">{result.bestMatchPage}</p>
        </div>
      )}

      {otherPages.length > 0 && (
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Also Found On
          </p>
          <p className="text-text">Pages {otherPages.join(', ')}</p>
        </div>
      )}

      <div className="mt-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Preview
        </p>
        <p className="text-sm text-text leading-relaxed">
          {highlightText(result.preview, result.highlightTerms)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {result.type === 'pdf' && openUrl && (
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-surface hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <OpenIcon />
            Open PDF
          </a>
        )}

        {isVideo && externalVideoUrl && (
          <a
            href={externalVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-600 hover:underline"
          >
            Open video
          </a>
        )}

        {matchingPages.length > 1 && (
          <span className="text-xs text-text-muted">
            {matchingPages.length} matching pages
          </span>
        )}
      </div>
    </Card>
  )
}

export default SearchResultCard
