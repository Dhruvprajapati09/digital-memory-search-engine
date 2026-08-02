import { getDisplayName } from '../../utils/memoryLibrary'
import { MOCK_RECENT_ACTIVITY } from './mockDashboardData'

export function getGreetingName(user) {
  if (user?.name?.trim()) return user.name.trim().split(/\s+/)[0]
  if (user?.email) return user.email.split('@')[0]
  return 'there'
}

export function formatRelativeTime(dateString) {
  if (!dateString) return 'Just now'

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Just now'

  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.max(0, Math.floor(diffMs / 1000))
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHour < 24) return `${diffHour} hr${diffHour === 1 ? '' : 's'} ago`
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function getMemoryStatus(documents, stats) {
  const docs = Array.isArray(documents) ? documents : []
  const total = stats?.totalDocuments ?? docs.length
  const indexed =
    stats?.totalIndexed ??
    docs.filter((d) => d.indexStatus === 'indexed').length
  const failed = docs.filter(
    (d) =>
      d.indexStatus === 'failed' ||
      d.extractionStatus === 'failed' ||
      d.status === 'failed',
  ).length
  const processing = docs.filter((d) => {
    const indexStatus = d.indexStatus ?? 'pending'
    const extractionStatus = d.status ?? d.extractionStatus ?? 'pending'
    return (
      indexStatus === 'processing' ||
      indexStatus === 'pending' ||
      extractionStatus === 'processing' ||
      extractionStatus === 'pending'
    )
  }).length

  let variant = 'success'
  let message = 'All documents indexed'

  if (total === 0) {
    variant = 'default'
    message = 'No documents yet'
  } else if (failed > 0) {
    variant = 'danger'
    message =
      failed === 1
        ? '1 document failed indexing'
        : `${failed} documents failed indexing`
  } else if (processing > 0 || indexed < total) {
    variant = 'warning'
    message =
      processing > 0
        ? `${processing} document${processing === 1 ? '' : 's'} processing`
        : 'Some documents are still indexing'
  }

  const lastUpdatedSource = docs.reduce((latest, doc) => {
    const candidate = doc.updatedAt || doc.indexedAt || doc.createdAt
    if (!candidate) return latest
    if (!latest) return candidate
    return new Date(candidate) > new Date(latest) ? candidate : latest
  }, null)

  return {
    variant,
    message,
    lastUpdated: lastUpdatedSource,
  }
}

/**
 * Build a recent activity list from documents + conversations when possible.
 * Falls back to mock data when nothing can be derived.
 *
 * TODO: Replace synthesis + mock fallback with a dedicated activity feed API.
 */
export function buildRecentActivity(documents, conversations) {
  const activities = []

  const docs = Array.isArray(documents) ? documents : []
  const chats = Array.isArray(conversations) ? conversations : []

  docs.slice(0, 8).forEach((doc) => {
    const name = getDisplayName(doc)
    activities.push({
      id: `upload-${doc.id}`,
      type: 'uploaded',
      description: `Uploaded "${name}"`,
      timestamp: doc.createdAt,
    })

    if (doc.indexStatus === 'indexed' && (doc.indexedAt || doc.updatedAt)) {
      activities.push({
        id: `index-${doc.id}`,
        type: 'indexed',
        description: `Indexed "${name}"`,
        timestamp: doc.indexedAt || doc.updatedAt,
      })
    }
  })

  chats.slice(0, 5).forEach((chat) => {
    const title = chat.title?.trim()
    if (!title || title.toLowerCase() === 'new chat') return
    activities.push({
      id: `ask-${chat._id}`,
      type: 'asked',
      description: `Asked "${title}"`,
      timestamp: chat.updatedAt || chat.createdAt,
    })
  })

  activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  if (activities.length === 0) {
    return MOCK_RECENT_ACTIVITY
  }

  return activities.slice(0, 6)
}

export function getRecentMemories(documents, limit = 5) {
  if (!Array.isArray(documents) || documents.length === 0) return []

  return [...documents]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit)
}
