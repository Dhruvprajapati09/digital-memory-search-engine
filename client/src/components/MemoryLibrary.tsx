import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MemoryRow from './MemoryRow'
import MemoryPreviewModal from './MemoryPreviewModal'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Spinner from './ui/Spinner'
import EmptyState from './ui/EmptyState'
import SearchBar from './ui/SearchBar'
import Toast, { type ToastMessage } from './ui/Toast'
import { fetchDocuments, deleteDocument } from '../services/documentService'
import type { Document } from '../types/document'
import {
  FILTER_OPTIONS,
  SORT_OPTIONS,
  filterAndSortDocuments,
  loadFavorites,
  saveFavorites,
  type MemoryFilter,
  type MemorySort,
} from '../utils/memoryLibrary'

function MemoryLibrary() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MemoryFilter>('all')
  const [sort, setSort] = useState<MemorySort>('newest')
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites())
  const [previewTarget, setPreviewTarget] = useState<Document | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ id: Date.now(), type, message })
  }

  const loadDocuments = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true)
      setError('')
    }

    try {
      const data = await fetchDocuments()
      setDocuments(data)
      if (opts?.silent) setError('')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load memories.'
      if (!opts?.silent) setError(message)
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  useEffect(() => {
    const isProcessing = documents.some((doc) => {
      const extraction = doc.extractionStatus ?? 'pending'
      const index = doc.indexStatus ?? 'pending'
      return (
        extraction === 'pending' ||
        extraction === 'processing' ||
        index === 'pending' ||
        index === 'processing'
      )
    })

    if (!isProcessing) return

    const interval = window.setInterval(() => {
      void loadDocuments({ silent: true })
    }, 4000)

    return () => window.clearInterval(interval)
  }, [documents, loadDocuments])

  const visibleDocuments = useMemo(
    () => filterAndSortDocuments(documents, query, filter, sort),
    [documents, query, filter, sort],
  )

  const handleToggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveFavorites(next)
      return next
    })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    setDeleting(true)

    try {
      await deleteDocument(deleteTarget.id)
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id))
      if (previewTarget?.id === deleteTarget.id) setPreviewTarget(null)
      showToast('success', 'Memory deleted successfully.')
      setDeleteTarget(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete memory.'
      showToast('error', message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchBar
          value={query}
          onChange={(e: { target: { value: string } }) => setQuery(e.target.value)}
          onSubmit={() => undefined}
          placeholder="Search Memories..."
          className="flex-1"
        />
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="memory-filter">
            Filter
          </label>
          <select
            id="memory-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as MemoryFilter)}
            className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="memory-sort">
            Sort
          </label>
          <select
            id="memory-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as MemorySort)}
            className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6">
        <Link to="/dashboard/upload">
          <Button onClick={() => undefined} aria-label="Add memory">
            + Add Memory
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner label="Loading memories" />
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-danger mb-4" role="alert">
            {error}
          </p>
          <Button onClick={() => void loadDocuments()} aria-label="Retry loading memories">
            Retry
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          title="No memories yet"
          description="Upload PDFs, notes, images, or links to build your AI memory library."
          icon={
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
          action={
            <Link to="/dashboard/upload">
              <Button onClick={() => undefined} aria-label="Upload memory">
                Upload Memory
              </Button>
            </Link>
          }
        />
      ) : visibleDocuments.length === 0 ? (
        <EmptyState
          title="No matching memories"
          description="Try a different search or filter."
          icon={null}
          action={null}
        />
      ) : (
        <div className="space-y-3">
          {visibleDocuments.map((doc) => (
            <MemoryRow
              key={doc.id}
              document={doc}
              favorited={favorites.has(doc.id)}
              onToggleFavorite={handleToggleFavorite}
              onPreview={setPreviewTarget}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <MemoryPreviewModal
        document={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete memory?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              aria-label="Cancel delete"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={deleting}
              aria-label="Confirm delete"
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          Are you sure you want to delete &quot;{deleteTarget?.title}&quot;?
          This action cannot be undone.
        </p>
      </Modal>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default MemoryLibrary
