import type { Chunk } from '../types/document'
import Card from './ui/Card'

interface ChunkListProps {
  chunks: Chunk[]
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncateText(text: string, maxLength = 200): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

function ChunkList({ chunks }: ChunkListProps) {
  if (chunks.length === 0) {
    return (
      <p className="text-sm text-text-muted py-4">
        No chunks indexed yet for this document.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {chunks.map((chunk) => (
        <Card key={chunk.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Chunk #{chunk.chunkIndex + 1}
            </h3>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span>{chunk.tokenCount} tokens</span>
              <span>·</span>
              <span>{formatDate(chunk.createdAt)}</span>
            </div>
          </div>
          <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap break-words">
            {truncateText(chunk.text)}
          </p>
        </Card>
      ))}
    </div>
  )
}

export default ChunkList
