import { useCallback, useEffect, useMemo, useState } from 'react'
import SearchBar from '../components/SearchBar'
import SearchFilters from '../components/SearchFilters'
import type { SearchFiltersValue } from '../components/SearchFilters'
import SearchResults from '../components/SearchResults'
import SearchHistoryPanel from '../components/SearchHistory'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { useSearchQuery } from '../hooks/useSearch'
import { askMemory } from '../services/searchService'
import type { SearchParams } from '../types/search'
import type { MemoryAnswer } from '../types/search'

const DEBOUNCE_MS = 400

function SearchPage() {
  const [inputValue, setInputValue] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [filters, setFilters] = useState<SearchFiltersValue>({})
  const [page, setPage] = useState(1)
  const [searched, setSearched] = useState(false)
  const [answer, setAnswer] = useState<MemoryAnswer | null>(null)
  const [answerLoading, setAnswerLoading] = useState(false)
  const [answerError, setAnswerError] = useState('')

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
    setAnswer(null)
    setAnswerError('')
    setSearched(false)
    setPage(1)
  }

  const loadAnswer = useCallback(async (query: string) => {
    setAnswerLoading(true)
    setAnswerError('')

    try {
      const result = await askMemory(query)
      setAnswer(result)
    } catch (err) {
      setAnswerError(
        err instanceof Error ? err.message : 'Failed to answer from memory.',
      )
      setAnswer(null)
    } finally {
      setAnswerLoading(false)
    }
  }, [])

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

  useEffect(() => {
    if (!searched || !submittedQuery.trim()) return
    loadAnswer(submittedQuery.trim())
  }, [searched, submittedQuery, loadAnswer])

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

      {searched && (
        <Card className="max-w-3xl mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                MemoryGPT answer
              </h2>
              {answer?.model && (
                <p className="text-xs text-text-muted mt-1">
                  Grounded by {answer.model}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadAnswer(submittedQuery)}
              loading={answerLoading}
              disabled={!submittedQuery}
            >
              Refresh
            </Button>
          </div>

          {answerLoading && (
            <p className="text-sm text-text-muted">Reading your indexed memories...</p>
          )}

          {answerError && (
            <p className="text-sm text-red-500" role="alert">
              {answerError}
            </p>
          )}

          {!answerLoading && answer && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-gray-800 whitespace-pre-wrap">
                {answer.answer}
              </p>

              {answer.citations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Sources
                  </h3>
                  <div className="space-y-2">
                    {answer.citations.slice(0, 4).map((citation) => (
                      <div
                        key={`${citation.documentId}-${citation.chunkIndex}`}
                        className="rounded-lg border border-border bg-gray-50 p-3"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {citation.title} · chunk {citation.chunkIndex + 1}
                        </p>
                        <p className="text-xs text-text-muted mt-1 line-clamp-2">
                          {citation.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

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
