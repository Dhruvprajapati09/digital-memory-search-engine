import Card from '../ui/Card'
import { formatRelativeTime } from './dashboardUtils'

const TYPE_STYLES = {
  uploaded: 'bg-primary-50 text-primary-600',
  asked: 'bg-primary-50 text-primary-600',
  indexed: 'bg-success/10 text-success',
  deleted: 'bg-danger/10 text-danger',
}

function ActivityIcon({ type }) {
  const className = 'w-4 h-4'

  if (type === 'asked') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    )
  }

  if (type === 'indexed') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 13l4 4L19 7" />
      </svg>
    )
  }

  if (type === 'deleted') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-8 0h10" />
      </svg>
    )
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function RecentActivityList({ activities, empty = false, error = '' }) {
  return (
    <Card className="h-full min-h-[280px] flex flex-col transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center gap-2 mb-4">
        <svg
          className="w-5 h-5 text-primary-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h2 className="text-lg font-semibold text-text">Recent Activity</h2>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!error && empty && (
        <p className="text-sm text-text-muted py-6">
          No recent activity yet. Upload a memory or ask AI to get started.
        </p>
      )}

      {!error && !empty && (
        <ul className="flex flex-col gap-3 flex-1">
          {activities.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg p-2 -mx-2 transition-colors duration-150 hover:bg-background"
            >
              <span
                className={`mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border shrink-0 ${TYPE_STYLES[item.type] || TYPE_STYLES.uploaded}`}
              >
                <ActivityIcon type={item.type} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text leading-snug">{item.description}</p>
                <p className="text-xs text-text-muted mt-1">
                  {formatRelativeTime(item.timestamp)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default RecentActivityList
