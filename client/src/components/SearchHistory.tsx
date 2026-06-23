import Button from './ui/Button'
import {
  useSearchHistory,
  useDeleteSearchHistoryItem,
  useClearSearchHistory,
} from '../hooks/useSearch'

interface SearchHistoryProps {
  onSelect: (query: string) => void
}

function SearchHistoryPanel({ onSelect }: SearchHistoryProps) {
  const { data: history = [], isLoading } = useSearchHistory()
  const deleteItem = useDeleteSearchHistoryItem()
  const clearAll = useClearSearchHistory()

  if (isLoading) {
    return (
      <p className="text-sm text-text-muted">Loading recent searches...</p>
    )
  }

  if (history.length === 0) {
    return null
  }

  return (
    <section aria-label="Recent searches" className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-800">Recent Searches</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clearAll.mutate()}
          loading={clearAll.isPending}
          disabled={clearAll.isPending}
        >
          Clear all
        </Button>
      </div>

      <ul className="flex flex-wrap gap-2">
        {history.map((item) => (
          <li key={item.id}>
            <div className="inline-flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-full bg-gray-100 text-sm text-gray-700">
              <button
                type="button"
                onClick={() => onSelect(item.query)}
                className="hover:text-primary-600"
              >
                {item.query}
              </button>
              <button
                type="button"
                onClick={() => deleteItem.mutate(item.id)}
                disabled={deleteItem.isPending}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                aria-label={`Remove "${item.query}" from history`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default SearchHistoryPanel
