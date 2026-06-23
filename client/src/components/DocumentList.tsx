import { useCallback, useEffect, useState } from 'react'
import DocumentCard from './DocumentCard'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Spinner from './ui/Spinner'
import EmptyState from './ui/EmptyState'
import { fetchDocuments, deleteDocument } from '../services/documentService'
import type { Document } from '../types/document'

interface DocumentListProps {
  refreshKey?: number
  onDocumentAdded?: (document: Document) => void
  onToast: (type: 'success' | 'error', message: string) => void
}

function DocumentList({ refreshKey = 0, onToast }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await fetchDocuments()
      setDocuments(data)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load documents.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments, refreshKey])

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    setDeleting(true)

    try {
      await deleteDocument(deleteTarget.id)
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id))
      onToast('success', 'Document deleted successfully.')
      setDeleteTarget(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete document.'
      onToast('error', message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading documents" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4" role="alert">{error}</p>
        <Button onClick={loadDocuments}>Retry</Button>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        title="No documents yet"
        description="Upload a file or save a note to get started."
        icon={
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />
    )
  }

  return (
    <>
      <div className="space-y-4">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onDelete={() => setDeleteTarget(doc)}
          />
        ))}
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete document?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={deleting}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete &quot;{deleteTarget?.title}&quot;?
          This action cannot be undone.
        </p>
      </Modal>
    </>
  )
}

export default DocumentList
