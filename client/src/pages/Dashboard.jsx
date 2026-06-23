import { useEffect, useState } from 'react'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { fetchDocuments } from '../services/documentService'

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
    total: 0,
    notes: 0,
    pdfs: 0,
    images: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadStats() {
      setLoading(true)
      setError('')

      try {
        const documents = await fetchDocuments()
        setStats({
          total: documents.length,
          notes: documents.filter((d) => d.type === 'note').length,
          pdfs: documents.filter((d) => d.type === 'pdf').length,
          images: documents.filter((d) => d.type === 'image').length,
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
        Overview of your saved documents and notes.
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
            label="Total Documents"
            value={stats.total}
            colorClass="bg-primary-50 text-primary-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
          <StatCard
            label="Notes"
            value={stats.notes}
            colorClass="bg-amber-50 text-amber-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            }
          />
          <StatCard
            label="PDFs"
            value={stats.pdfs}
            colorClass="bg-red-50 text-red-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            label="Images"
            value={stats.images}
            colorClass="bg-green-50 text-green-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>
      )}
    </div>
  )
}

export default Dashboard
