import { useCallback, useEffect, useMemo, useState } from 'react'
import SearchBar from '../components/SearchBar'
import SearchFilters from '../components/SearchFilters'
import type { SearchFiltersValue } from '../components/SearchFilters'
import SearchResults from '../components/SearchResults'
import SearchHistoryPanel from '../components/SearchHistory'
import { useSearchQuery } from '../hooks/useSearch'
import type { SearchParams } from '../types/search'

const DEBOUNCE_MS = 400

function SearchPage() {
  const [inputValue, setInputValue] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [filters, setFilters] = useState<SearchFiltersValue>({})
  const [page, setPage] = useState(1)
  const [searched, setSearched] = useState(false)

  const searchParams = useMemo<SearchParams | null>(() => {
    if (!submittedQuery.trim()) return null

    return {
      q: submittedQuery.trim(),
      page,
      limit: 20,
      ...filters,
    }
  }, [submittedQuery, page, filters])

  const { data, isFetching, error } = useSearchQuery(searchParams, searched)

  const runSearch = useCallback((query: string) => {
    const trimmed = query.trim()

    if (!trimmed) return

    setSubmittedQuery(trimmed)
    setInputValue(trimmed)
    setPage(1)
    setSearched(true)
  }, [])

  const handleClear = () => {
    setInputValue('')
    setSubmittedQuery('')
    setSearched(false)
    setPage(1)
  }

  // Debounced search while typing (optional live search after first submit)
  useEffect(() => {
    if (!searched || !inputValue.trim()) return

    const timer = window.setTimeout(() => {
      if (inputValue.trim() !== submittedQuery) {
        setSubmittedQuery(inputValue.trim())
        setPage(1)
      }
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [inputValue, searched, submittedQuery])

  // Re-run search when filters change
  useEffect(() => {
    if (searched && submittedQuery) {
      setPage(1)
    }
  }, [filters, searched, submittedQuery])

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Search</h1>
      <p className="text-sm text-text-muted mb-6">
        Use natural language to find anything in your memory library.
      </p>

      <SearchBar
        value={inputValue}
        onChange={setInputValue}
        onSubmit={runSearch}
        onClear={handleClear}
        loading={isFetching && searched}
        className="max-w-3xl mb-4"
      />

      <SearchFilters
        value={filters}
        onChange={setFilters}
        className="max-w-3xl mb-6"
      />

      {!searched && (
        <SearchHistoryPanel onSelect={runSearch} />
      )}

      <SearchResults
        results={data?.results ?? []}
        query={submittedQuery}
        loading={isFetching && searched}
        searched={searched}
        totalResults={data?.totalResults ?? 0}
        page={data?.page ?? page}
        totalPages={data?.totalPages ?? 0}
        onPageChange={setPage}
        error={error instanceof Error ? error.message : null}
      />
    </div>
  )
}

export default SearchPage
