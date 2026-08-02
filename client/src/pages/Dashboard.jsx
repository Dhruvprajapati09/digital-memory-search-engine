import { useEffect, useState } from 'react'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { fetchDocumentStats, fetchDocuments } from '../services/documentService'
import { fetchSearchStats } from '../services/searchService'
import { listConversations } from '../services/chatService'
import WelcomeSection from '../components/dashboard/WelcomeSection'
import OverviewCards from '../components/dashboard/OverviewCards'
import SearchActivityChart from '../components/dashboard/SearchActivityChart'
import RecentActivityList from '../components/dashboard/RecentActivityList'
import RecentMemoriesList from '../components/dashboard/RecentMemoriesList'
import MemoryStatusPanel from '../components/dashboard/MemoryStatusPanel'
import { MOCK_SEARCH_ACTIVITY } from '../components/dashboard/mockDashboardData'
import {
  getGreetingName,
  getRecentMemories,
  buildRecentActivity,
  getMemoryStatus,
} from '../components/dashboard/dashboardUtils'

function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalExtracted: 0,
    totalIndexed: 0,
    totalChunks: 0,
    totalSearches: 0,
    searchesToday: 0,
    averageResultsReturned: 0,
  })
  const [aiChats, setAiChats] = useState(0)
  const [documents, setDocuments] = useState([])
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sectionError, setSectionError] = useState({
    documents: '',
    conversations: '',
  })

  useEffect(() => {
    async function loadStats() {
      setLoading(true)
      setError('')
      setSectionError({ documents: '', conversations: '' })

      try {
        const [docStats, searchStats, documentsResult, conversationsResult] =
          await Promise.all([
            fetchDocumentStats(),
            fetchSearchStats(),
            fetchDocuments().then(
              (docs) => ({ ok: true, docs }),
              (err) => ({
                ok: false,
                error:
                  err instanceof Error
                    ? err.message
                    : 'Failed to load recent memories.',
              }),
            ),
            listConversations().then(
              (data) => ({ ok: true, data }),
              (err) => ({
                ok: false,
                error:
                  err instanceof Error
                    ? err.message
                    : 'Failed to load AI chats.',
              }),
            ),
          ])

        setStats({
          ...docStats,
          totalSearches: searchStats.totalSearches,
          searchesToday: searchStats.searchesToday,
          averageResultsReturned: searchStats.averageResultsReturned,
        })

        if (documentsResult.ok) {
          setDocuments(documentsResult.docs)
        } else {
          setDocuments([])
          setSectionError((prev) => ({
            ...prev,
            documents: documentsResult.error,
          }))
        }

        if (conversationsResult.ok) {
          const chats = conversationsResult.data.conversations || []
          setConversations(chats)
          setAiChats(chats.length)
        } else {
          setConversations([])
          setAiChats(0)
          setSectionError((prev) => ({
            ...prev,
            conversations: conversationsResult.error,
          }))
        }
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

  const greetingName = getGreetingName(user)
  const readyCount = stats.totalIndexed || stats.totalDocuments
  const recentMemories = getRecentMemories(documents, 5)
  const activities = buildRecentActivity(documents, conversations)
  const memoryStatus = getMemoryStatus(documents, stats)
  const lastUpdated =
    memoryStatus.lastUpdated || (!loading && !error ? new Date().toISOString() : null)

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner label="Loading dashboard" />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <WelcomeSection name={greetingName} readyCount={readyCount} />

          <OverviewCards
            documents={stats.totalDocuments}
            searches={stats.totalSearches}
            aiChats={aiChats}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* TODO: Pass real daily search series when analytics API exists. */}
            <SearchActivityChart data={MOCK_SEARCH_ACTIVITY} />
            <RecentActivityList
              activities={activities}
              empty={activities.length === 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecentMemoriesList
              memories={recentMemories}
              empty={recentMemories.length === 0 && !sectionError.documents}
              error={sectionError.documents}
            />
            <MemoryStatusPanel
              status={memoryStatus}
              lastUpdated={lastUpdated}
            />
          </div>

          {sectionError.conversations && (
            <p role="status" className="text-xs text-text-muted">
              AI chat count may be incomplete: {sectionError.conversations}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard
