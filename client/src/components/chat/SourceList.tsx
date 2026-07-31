import type { ChatSource } from '../../types/chat'

interface SourceListProps {
  sources: ChatSource[]
}

function SourceList({ sources }: SourceListProps) {
  if (!sources.length) return null

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
        Sources
      </p>
      <ul className="space-y-2">
        {sources.map((source, index) => (
          <li
            key={`${source.documentId}-${index}`}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <p className="font-medium text-text">
              {source.documentName}
              {typeof source.page === 'number' ? (
                <span className="text-text-muted font-normal">
                  {' '}
                  · p. {source.page}
                </span>
              ) : null}
            </p>
            {source.preview ? (
              <p className="mt-1 text-text-muted line-clamp-2">
                {source.preview}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SourceList
