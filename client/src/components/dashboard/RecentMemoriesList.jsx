import { Link } from 'react-router-dom'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { getDisplayName, formatRelativeUploadDate } from '../../utils/memoryLibrary'

function FileIcon({ type }) {
  return (
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary-50 text-primary-600 border border-border shrink-0">
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {type === 'video' ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        )}
      </svg>
    </span>
  )
}

function RecentMemoriesList({ memories, empty = false, error = '' }) {
  return (
    <Card className="h-full min-h-[280px] flex flex-col transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h2 className="text-lg font-semibold text-text">
            Recently Added Memories
          </h2>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!error && empty && (
        <div className="flex-1 flex flex-col justify-center py-4">
          <p className="text-sm text-text-muted mb-4">No memories yet.</p>
          <Link to="/dashboard/upload">
            <Button size="sm">Upload Memory</Button>
          </Link>
        </div>
      )}

      {!error && !empty && (
        <>
          <ul className="flex flex-col gap-2 flex-1">
            {memories.map((doc) => (
              <li key={doc.id}>
                <Link
                  to={`/dashboard/documents/${doc.id}`}
                  className="flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors duration-150 hover:bg-background"
                >
                  <FileIcon type={doc.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text truncate">
                      {getDisplayName(doc)}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatRelativeUploadDate(doc.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-4 pt-3 border-t border-border">
            <Link
              to="/dashboard/memories"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              View All
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </>
      )}
    </Card>
  )
}

export default RecentMemoriesList
