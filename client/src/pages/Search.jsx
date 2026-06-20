import { useState } from 'react'
import SearchBar from '../components/ui/SearchBar'
import EmptyState from '../components/ui/EmptyState'

function Search() {
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)

  const handleSearch = (q) => {
    setSearched(true)
    console.log('Search query:', q)
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Search</h1>
      <p className="text-sm text-text-muted mb-6">
        Use natural language to find anything in your memory library.
      </p>

      <SearchBar
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSubmit={handleSearch}
        placeholder="What do you remember about..."
        className="max-w-2xl mb-8"
      />

      {searched ? (
        <EmptyState
          title="No search results"
          description={`No memories matched "${query}". Try a different query.`}
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
      ) : (
        <EmptyState
          title="Start searching"
          description="Type a question or keyword above to search your memories."
        />
      )}
    </div>
  )
}

export default Search
