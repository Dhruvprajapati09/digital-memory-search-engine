import { useState } from 'react'
import type { ChatSource } from '../../types/chat'
import { prepareSources } from '../../utils/chatSources'

const INITIAL_VISIBLE = 3

interface SourceListProps {
  sources: ChatSource[]
}

function SourceList({ sources }: SourceListProps) {
  const [expanded, setExpanded] = useState(false)
  const prepared = prepareSources(sources)

  if (!prepared.length) return null

  const hasMore = prepared.length > INITIAL_VISIBLE
  const visible = expanded ? prepared : prepared.slice(0, INITIAL_VISIBLE)
  const remaining = prepared.length - INITIAL_VISIBLE

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
        Sources
      </p>
      <ul className="space-y-2">
        {visible.map((source, index) => (
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

      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          {expanded ? 'Show Less' : `View More (${remaining})`}
        </button>
      ) : null}
    </div>
  )
}

export default SourceList
