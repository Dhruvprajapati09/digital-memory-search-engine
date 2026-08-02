import Card from '../ui/Card'
import Badge from '../ui/Badge'
import { formatRelativeTime } from './dashboardUtils'

function MemoryStatusPanel({ status, lastUpdated }) {
  const variant = status?.variant || 'default'
  const message = status?.message || 'Status unavailable'

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
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        <h2 className="text-lg font-semibold text-text">Memory Status</h2>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-4">
        <div className="flex items-start gap-3">
          <Badge variant={variant}>{message}</Badge>
        </div>

        <p className="text-sm text-text-muted">
          Last Updated :{' '}
          <span className="text-text font-medium">
            {formatRelativeTime(lastUpdated)}
          </span>
        </p>
      </div>
    </Card>
  )
}

export default MemoryStatusPanel
