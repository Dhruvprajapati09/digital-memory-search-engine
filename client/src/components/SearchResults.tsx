import SearchResultCard from './SearchResultCard'
import SearchSkeleton from './SearchSkeleton'
import EmptyState from './ui/EmptyState'
import Button from './ui/Button'
import type { SearchResult } from '../types/search'

interface SearchResultsProps {
  results: SearchResult[]
  query: string
  loading: boolean
  searched: boolean
  totalResults: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  error?: string | null
}

function SearchResults({
  results,
  query,
  loading,
  searched,
  totalResults,
  page,
  totalPages,
  onPageChange,
  error,
}: SearchResultsProps) {
  if (loading) {
    return (
      <div>
        <p className="text-sm text-text-muted mb-4">Searching your memory...</p>
        <SearchSkeleton count={3} />
      </div>
    )
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-500">
        {error}
      </p>
    )
  }

  if (!searched) {
    return (
      <EmptyState
        title="Start searching"
        description="Type a question or keyword above to search your memories."
        icon={
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      />
    )
  }

  if (results.length === 0) {
    return (
      <EmptyState
        title="No matching documents found"
        description={`No memories matched "${query}".`}
        icon={
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        action={
          <ul className="text-sm text-text-muted text-left max-w-xs mx-auto space-y-1 mt-2">
            <li>· Try different keywords</li>
            <li>· Remove filters</li>
            <li>· Upload more content</li>
          </ul>
        }
      />
    )
  }

  return (
    <div>
      <p className="text-sm text-text-muted mb-4">
        {totalResults} result{totalResults !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
      </p>

      <div className="space-y-4">
        {results.map((result) => (
          <SearchResultCard key={result.documentId} result={result} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-center gap-3 mt-8"
          aria-label="Search results pagination"
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-text-muted">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  )
}

export default SearchResults
