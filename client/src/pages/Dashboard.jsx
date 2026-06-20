import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import SearchBar from '../components/ui/SearchBar'
import { useState } from 'react'

function Dashboard() {
  const [query, setQuery] = useState('')

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-sm text-text-muted mb-6">
        Search across all your saved memories, notes, and documents.
      </p>

      <SearchBar
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSubmit={(q) => console.log('Search:', q)}
        className="max-w-2xl mb-8"
      />

      <EmptyState
        title="No memories yet"
        description="Once you start saving information, it will show up here."
        icon={
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
        action={<Button>Add your first memory</Button>}
      />
    </div>
  )
}

export default Dashboard
