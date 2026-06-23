import { useEffect, useState } from 'react'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { fetchDocumentStats } from '../services/documentService'
import { fetchSearchStats } from '../services/searchService'

function StatCard({ label, value, icon, colorClass }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </Card>
  )
}

function Dashboard() {
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalExtracted: 0,
    totalIndexed: 0,
    totalChunks: 0,
    totalSearches: 0,
    searchesToday: 0,
    averageResultsReturned: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadStats() {
      setLoading(true)
      setError('')

      try {
        const [docStats, searchStats] = await Promise.all([
          fetchDocumentStats(),
          fetchSearchStats(),
        ])

        setStats({
          ...docStats,
          totalSearches: searchStats.totalSearches,
          searchesToday: searchStats.searchesToday,
          averageResultsReturned: searchStats.averageResultsReturned,
        })
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load dashboard stats.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-sm text-text-muted mb-6">
        Overview of your documents, search index, and search activity.
      </p>

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner label="Loading dashboard" />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-500 mb-6">{error}</p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Searches"
            value={stats.totalSearches}
            colorClass="bg-primary-50 text-primary-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
          <StatCard
            label="Searches Today"
            value={stats.searchesToday}
            colorClass="bg-amber-50 text-amber-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Avg Results Returned"
            value={stats.averageResultsReturned}
            colorClass="bg-green-50 text-green-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
          <StatCard
            label="Indexed Documents"
            value={stats.totalIndexed}
            colorClass="bg-red-50 text-red-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
        </div>
      )}
    </div>
  )
}

export default Dashboard
