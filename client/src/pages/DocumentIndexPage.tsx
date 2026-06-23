import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ChunkList from '../components/ChunkList'
import IndexStatusBadge from '../components/IndexStatusBadge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import {
  fetchDocument,
  fetchDocumentChunks,
  fetchDocumentIndexStatus,
  reindexDocument,
} from '../services/documentService'
import type { Chunk, Document, ExtractionStatus, IndexStatus } from '../types/document'

function formatDate(dateString?: string | null): string {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DocumentIndexPage() {
  const { id } = useParams<{ id: string }>()
  const [document, setDocument] = useState<Document | null>(null)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [indexStatus, setIndexStatus] = useState<IndexStatus>('pending')
  const [chunkCount, setChunkCount] = useState(0)
  const [indexedAt, setIndexedAt] = useState<string | null>(null)
  const [indexError, setIndexError] = useState<string | null>(null)
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('pending')
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reindexing, setReindexing] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return

    try {
      const [doc, statusData, chunksData] = await Promise.all([
        fetchDocument(id),
        fetchDocumentIndexStatus(id),
        fetchDocumentChunks(id),
      ])

      setDocument(doc)
      setIndexStatus(statusData.status)
      setChunkCount(statusData.chunkCount)
      setIndexedAt(statusData.indexedAt ?? null)
      setIndexError(statusData.indexError ?? null)
      setExtractionStatus(statusData.extractionStatus ?? doc.extractionStatus ?? 'pending')
      setExtractionError(statusData.extractionError ?? doc.extractionError ?? null)
      setChunks(chunksData)
      setError('')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load index data.',
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const isExtracting =
      extractionStatus === 'pending' || extractionStatus === 'processing'
    const isIndexing = indexStatus === 'pending' || indexStatus === 'processing'

    if (!isExtracting && !isIndexing) return

    const interval = window.setInterval(loadData, 3000)
    return () => window.clearInterval(interval)
  }, [indexStatus, extractionStatus, loadData])

  const handleReindex = async () => {
    if (!id) return

    setReindexing(true)

    try {
      await reindexDocument(id)
      setIndexStatus('processing')
      setExtractionStatus((prev) =>
        prev === 'completed' ? prev : 'processing',
      )
      setIndexError(null)
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reindex document.',
      )
    } finally {
      setReindexing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading index data" />
      </div>
    )
  }

  if (error && !document) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4" role="alert">{error}</p>
        <Link to="/dashboard/upload">
          <Button>Back to Documents</Button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          to={`/dashboard/documents/${id}`}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          ← Back to Document
        </Link>
      </div>

      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
        Search Index
      </h1>
      <p className="text-sm text-text-muted mb-6">
        {document?.title} — semantic chunks and embedding status
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-500 mb-4">{error}</p>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
            <div>
              <p className="text-xs text-text-muted">Index Status</p>
              <div className="mt-1">
                <IndexStatusBadge status={indexStatus} />
              </div>
            </div>
            <div>
              <p className="text-xs text-text-muted">Chunk Count</p>
              <p className="text-lg font-semibold text-gray-900">{chunkCount}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Indexed At</p>
              <p className="text-sm text-gray-800">{formatDate(indexedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Embedding Model</p>
              <p className="text-sm text-gray-800 font-mono">
                {document?.embeddingModel ?? '—'}
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={handleReindex}
            loading={reindexing}
            disabled={indexStatus === 'processing' || extractionStatus === 'processing'}
          >
            Reindex
          </Button>
        </div>

        {(extractionStatus === 'pending' || extractionStatus === 'processing') && (
          <div className="flex items-center gap-2 mt-4 text-sm text-text-muted">
            <Spinner size="sm" inline label="Extracting" />
            <span>Extracting text before indexing...</span>
          </div>
        )}

        {(indexStatus === 'pending' || indexStatus === 'processing') &&
          extractionStatus === 'completed' && (
          <div className="flex items-center gap-2 mt-4 text-sm text-text-muted">
            <Spinner size="sm" inline label="Indexing" />
            <span>Indexing document for semantic search...</span>
          </div>
        )}

        {indexStatus === 'failed' && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-800">Indexing failed</p>
            {indexError && (
              <p className="text-sm text-red-600 mt-1">{indexError}</p>
            )}
            {extractionStatus === 'failed' && extractionError && (
              <p className="text-sm text-red-600 mt-1">
                Extraction error: {extractionError}
              </p>
            )}
            <Button
              className="mt-3"
              size="sm"
              onClick={handleReindex}
              loading={reindexing}
            >
              Retry (Extract + Index)
            </Button>
          </div>
        )}
      </Card>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Indexed Chunks</h2>
      <ChunkList chunks={chunks} />
    </div>
  )
}

export default DocumentIndexPage
