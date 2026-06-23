import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ExtractedTextViewer from '../components/ExtractedTextViewer'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'
import {
  fetchDocument,
  reprocessDocument,
} from '../services/documentService'
import type { Document, ExtractionStatus } from '../types/document'

function getStatus(document: Document): ExtractionStatus {
  return document.status ?? document.extractionStatus ?? 'pending'
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

  // Poll while extraction is in progress
  useEffect(() => {
    if (!document) return

    const status = getStatus(document)
    if (status !== 'pending' && status !== 'processing') return

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

  const status = getStatus(document)

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
          <Badge
            variant={
              status === 'completed'
                ? 'success'
                : status === 'failed'
                  ? 'danger'
                  : status === 'processing'
                    ? 'primary'
                    : 'warning'
            }
          >
            {status}
          </Badge>
        </div>
      </Card>

      <Card>
        <ExtractedTextViewer
          text={document.extractedText}
          status={status}
          error={document.extractionError}
          onReprocess={handleReprocess}
          reprocessing={reprocessing}
        />
      </Card>
    </div>
  )
}

export default DocumentDetailPage
