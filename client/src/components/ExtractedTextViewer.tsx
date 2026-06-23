import type { ExtractionStatus } from '../types/document'
import Badge from './ui/Badge'
import Spinner from './ui/Spinner'
import Button from './ui/Button'

interface ExtractedTextViewerProps {
  text?: string
  status: ExtractionStatus
  error?: string | null
  onReprocess?: () => void
  reprocessing?: boolean
}

function StatusBadge({ status }: { status: ExtractionStatus }) {
  const config: Record<
    ExtractionStatus,
    { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' }
  > = {
    pending: { label: 'Pending', variant: 'warning' },
    processing: { label: 'Processing', variant: 'primary' },
    completed: { label: 'Completed', variant: 'success' },
    failed: { label: 'Failed', variant: 'danger' },
  }

  const { label, variant } = config[status]

  return <Badge variant={variant}>{label}</Badge>
}

function ExtractedTextViewer({
  text,
  status,
  error,
  onReprocess,
  reprocessing = false,
}: ExtractedTextViewerProps) {
  const isProcessing = status === 'pending' || status === 'processing'

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Extracted Text</h2>
        <StatusBadge status={status} />
      </div>

      {isProcessing && (
        <div className="flex items-center gap-3 py-8 justify-center text-text-muted">
          <Spinner size="sm" inline label="Extracting" />
          <span>Extracting text...</span>
        </div>
      )}

      {status === 'failed' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4">
          <p className="text-sm font-medium text-red-800">Extraction failed</p>
          {error && (
            <p className="text-sm text-red-600 mt-1">{error}</p>
          )}
          {onReprocess && (
            <Button
              className="mt-3"
              size="sm"
              onClick={onReprocess}
              loading={reprocessing}
            >
              Retry Extraction
            </Button>
          )}
        </div>
      )}

      {status === 'completed' && text && (
        <div
          className="max-h-96 overflow-y-auto rounded-lg border border-border bg-gray-50 p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap break-words"
          role="region"
          aria-label="Extracted text content"
        >
          {text}
        </div>
      )}

      {status === 'completed' && !text && (
        <p className="text-sm text-text-muted py-4">
          No text was extracted from this document.
        </p>
      )}
    </div>
  )
}

export default ExtractedTextViewer
