import { Link } from 'react-router-dom'
import Card from './ui/Card'
import Badge from './ui/Badge'
import type { SearchResult } from '../types/search'
import {
  highlightText,
  formatMatchScore,
  formatDocumentType,
} from '../utils/searchHighlight'

interface SearchResultCardProps {
  result: SearchResult
}

function SearchResultCard({ result }: SearchResultCardProps) {
  const createdDate = new Date(result.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const isVideo = result.type === 'video'
  const externalVideoUrl =
    result.videoUrl ??
    (result.youtubeVideoId && result.timestampSeconds !== undefined
      ? `https://www.youtube.com/watch?v=${result.youtubeVideoId}&t=${result.timestampSeconds}s`
      : result.youtubeVideoId
        ? `https://www.youtube.com/watch?v=${result.youtubeVideoId}`
        : undefined)

  return (
    <Card className="hover:border-primary-200 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex gap-3 min-w-0 flex-1">
          {isVideo && result.thumbnail && (
            <img
              src={result.thumbnail}
              alt=""
              className="w-20 h-14 object-cover rounded-lg shrink-0"
            />
          )}
          <div className="min-w-0">
            {isVideo && externalVideoUrl ? (
              <a
                href={externalVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-gray-900 hover:text-primary-600"
              >
                {result.title}
              </a>
            ) : (
              <Link
                to={`/dashboard/documents/${result.documentId}`}
                className="text-lg font-semibold text-gray-900 hover:text-primary-600"
              >
                {result.title}
              </Link>
            )}
            <p className="text-xs text-text-muted mt-0.5">
              {formatDocumentType(result.type)}
              {result.channel ? ` · ${result.channel}` : ''}
              {result.timestamp ? ` · ${result.timestamp}` : ''}
              {' · '}
              {createdDate}
            </p>
          </div>
        </div>
        <Badge variant="success">{formatMatchScore(result.score)}</Badge>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed mb-3">
        {highlightText(result.preview, result.highlightTerms)}
      </p>

      {(result.topTopic || result.topSubtopic) && (
        <p className="text-xs text-primary-700 mb-2">
          Topic: {result.topTopic}
          {result.topSubtopic && result.topSubtopic !== result.topTopic
            ? ` → ${result.topSubtopic}`
            : ''}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span>Matched Chunks: {result.matchedChunks.length}</span>
        {isVideo && externalVideoUrl && (
          <a
            href={externalVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline"
          >
            Open at timestamp
          </a>
        )}
        <Link
          to={`/dashboard/documents/${result.documentId}/index`}
          className="text-primary-600 hover:underline"
        >
          View chunks
        </Link>
      </div>
    </Card>
  )
}

export default SearchResultCard
