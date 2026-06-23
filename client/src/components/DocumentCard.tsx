import { getFileUrl } from '../services/documentService'
import type { Document, DocumentType } from '../types/document'
import Button from './ui/Button'
import Card from './ui/Card'

interface DocumentCardProps {
  document: Document
  onDelete: (id: string) => void
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function TypeIcon({ type }: { type: DocumentType }) {
  if (type === 'image') {
    return (
      <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  }

  if (type === 'pdf') {
    return (
      <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }

  return (
    <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const imageUrl = document.type === 'image' ? getFileUrl(document) : null

  return (
    <Card className="flex flex-col sm:flex-row gap-4">
      <div className="shrink-0 flex items-center justify-center w-full sm:w-24 h-24 bg-gray-50 rounded-lg border border-border overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={document.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <TypeIcon type={document.type} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900 truncate">{document.title}</h3>
            <p className="text-sm text-text-muted capitalize">{document.type}</p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(document.id)}
            aria-label={`Delete ${document.title}`}
          >
            Delete
          </Button>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>
            <dt className="text-text-muted">Uploaded</dt>
            <dd className="text-gray-800">{formatDate(document.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">File size</dt>
            <dd className="text-gray-800">{formatFileSize(document.fileSize)}</dd>
          </div>
        </dl>

        {document.type === 'note' && document.noteContent && (
          <p className="mt-3 text-sm text-gray-700 line-clamp-2">
            {document.noteContent}
          </p>
        )}
      </div>
    </Card>
  )
}

export default DocumentCard
