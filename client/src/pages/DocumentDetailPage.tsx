import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ExtractedTextViewer from '../components/ExtractedTextViewer'
import IndexStatusBadge from '../components/IndexStatusBadge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'
import {
  fetchDocument,
  reprocessDocument,
} from '../services/documentService'
import type { Document, ExtractionStatus, IndexStatus } from '../types/document'

function getExtractionStatus(document: Document): ExtractionStatus {
  return document.status ?? document.extractionStatus ?? 'pending'
}

function getIndexStatus(document: Document): IndexStatus {
  return document.indexStatus ?? 'pending'
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reprocessing, setReprocessing] = useState(false)

  const loadDocument = useCallback(async () => {
    if (!id) return

    try {
      const data = await fetchDocument(id)
      setDocument(data)
      setError('')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load document.',
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDocument()
  }, [loadDocument])

  useEffect(() => {
    if (!document) return

    const extractionStatus = getExtractionStatus(document)
    const indexStatus = getIndexStatus(document)
    const isProcessing =
      extractionStatus === 'pending' ||
      extractionStatus === 'processing' ||
      indexStatus === 'pending' ||
      indexStatus === 'processing'

    if (!isProcessing) return

    const interval = window.setInterval(loadDocument, 2500)
    return () => window.clearInterval(interval)
  }, [document, loadDocument])

  const handleReprocess = async () => {
    if (!id) return

    setReprocessing(true)

    try {
      await reprocessDocument(id)
      setDocument((prev) =>
        prev
          ? {
              ...prev,
              extractionStatus: 'processing',
              status: 'processing',
              extractionError: null,
              indexStatus: 'pending',
            }
          : prev,
      )
      await loadDocument()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reprocess document.',
      )
    } finally {
      setReprocessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading document" />
      </div>
    )
  }

  if (error && !document) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4" role="alert">{error}</p>
        <Button onClick={() => navigate('/dashboard/upload')}>
          Back to Documents
        </Button>
      </div>
    )
  }

  if (!document) {
    return null
  }

  const extractionStatus = getExtractionStatus(document)
  const indexStatus = getIndexStatus(document)

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/dashboard/upload"
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          ← Back to Documents
        </Link>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              {document.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
              <span className="capitalize">{document.type}</span>
              <span>·</span>
              <span>Uploaded {formatDate(document.createdAt)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                extractionStatus === 'completed'
                  ? 'success'
                  : extractionStatus === 'failed'
                    ? 'danger'
                    : extractionStatus === 'processing'
                      ? 'primary'
                      : 'warning'
              }
            >
              Extraction: {extractionStatus}
            </Badge>
            <IndexStatusBadge status={indexStatus} />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-text-muted">Chunk Count</dt>
            <dd className="font-semibold text-gray-900">
              {document.chunkCount ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Indexed At</dt>
            <dd className="text-gray-800">
              {document.indexedAt
                ? formatDate(document.indexedAt)
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Embedding Model</dt>
            <dd className="text-gray-800 font-mono text-xs">
              {document.embeddingModel ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Search Index</dt>
            <dd>
              <Link
                to={`/dashboard/documents/${id}/index`}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                View chunks →
              </Link>
            </dd>
          </div>
        </dl>

        {document.indexError && indexStatus === 'failed' && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            Index error: {document.indexError}
          </p>
        )}
      </Card>

      <Card>
        <ExtractedTextViewer
          text={document.extractedText}
          status={extractionStatus}
          error={document.extractionError}
          onReprocess={handleReprocess}
          reprocessing={reprocessing}
        />
      </Card>
    </div>
  )
}

export default DocumentDetailPage
