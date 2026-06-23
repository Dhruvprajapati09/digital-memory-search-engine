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

  return (
    <Card className="hover:border-primary-200 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <Link
            to={`/dashboard/documents/${result.documentId}`}
            className="text-lg font-semibold text-gray-900 hover:text-primary-600"
          >
            {result.title}
          </Link>
          <p className="text-xs text-text-muted mt-0.5">
            {formatDocumentType(result.type)} · {createdDate}
          </p>
        </div>
        <Badge variant="success">{formatMatchScore(result.score)}</Badge>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed mb-3">
        {highlightText(result.preview, result.highlightTerms)}
      </p>

      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span>Matched Chunks: {result.matchedChunks.length}</span>
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
