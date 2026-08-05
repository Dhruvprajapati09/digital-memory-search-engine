import { useCallback, useEffect, useMemo, useState } from 'react'
import SearchBar from '../components/SearchBar'
import SearchFilters from '../components/SearchFilters'
import type { SearchFiltersValue } from '../components/SearchFilters'
import SearchOptionsPanel from '../components/SearchOptions'
import SearchResults from '../components/SearchResults'
import SearchHistoryPanel from '../components/SearchHistory'
import { useSearchQuery } from '../hooks/useSearch'
import type { SearchOptions, SearchParams } from '../types/search'

function SearchPage() {
  const [inputValue, setInputValue] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [filters, setFilters] = useState<SearchFiltersValue>({})
  const [options, setOptions] = useState<SearchOptions>({
    matchMode: 'phrase',
    caseSensitive: false,
    wholeWord: false,
    prefix: false,
  })
  const [page, setPage] = useState(1)
  const [searched, setSearched] = useState(false)

  const searchParams = useMemo<SearchParams | null>(() => {
    if (!submittedQuery.trim()) return null

    return {
      q: submittedQuery.trim(),
      page,
      limit: 20,
      ...filters,
      ...options,
    }
  }, [submittedQuery, page, filters, options])

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

  useEffect(() => {
    if (searched && submittedQuery) {
      setPage(1)
    }
  }, [filters, options, searched, submittedQuery])

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-semibold text-text mb-2">
        Document Search
      </h1>
      <p className="text-sm text-text-muted mb-6">
        Find exact text across every uploaded document — like Ctrl+F for your
        entire library.
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
        className="max-w-3xl mb-3"
      />

      <SearchOptionsPanel
        value={options}
        onChange={setOptions}
        className="max-w-3xl mb-6"
      />

      {!searched && <SearchHistoryPanel onSelect={runSearch} />}

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
