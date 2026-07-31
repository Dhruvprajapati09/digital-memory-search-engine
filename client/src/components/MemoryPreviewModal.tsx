import { useEffect, useRef } from 'react'
import type { Document } from '../types/document'
import Button from './ui/Button'
import { getFileUrl } from '../services/documentService'
import { getDisplayName } from '../utils/memoryLibrary'

interface MemoryPreviewModalProps {
  document: Document | null
  onClose: () => void
}

function MemoryPreviewModal({ document, onClose }: MemoryPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!document) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.document.addEventListener('keydown', handleKeyDown)
    window.document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    return () => {
      window.document.removeEventListener('keydown', handleKeyDown)
      window.document.body.style.overflow = ''
    }
  }, [document, onClose])

  if (!document) return null

  const displayName = getDisplayName(document)
  const fileUrl = getFileUrl(document)

  const handleDownload = () => {
    if (document.type === 'note') {
      const blob = new Blob(
        [document.noteContent || document.extractedText || ''],
        { type: 'text/plain' },
      )
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = `${displayName}.txt`
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    if (document.type === 'video' && document.videoUrl) {
      window.open(document.videoUrl, '_blank', 'noopener,noreferrer')
      return
    }

    if (!fileUrl) return
    const a = window.document.createElement('a')
    a.href = fileUrl
    a.download = document.originalFileName || displayName
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  const canDownload =
    document.type === 'note' ||
    Boolean(fileUrl) ||
    Boolean(document.videoUrl)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-text/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-preview-title"
        tabIndex={-1}
        className="relative z-10 flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-md"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2
            id="memory-preview-title"
            className="min-w-0 truncate text-lg font-semibold text-text font-display"
          >
            {displayName}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {canDownload && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                aria-label="Download memory"
              >
                Download
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close preview">
              ✕
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-background p-4">
          <PreviewBody document={document} fileUrl={fileUrl} />
        </div>
      </div>
    </div>
  )
}

function PreviewBody({
  document,
  fileUrl,
}: {
  document: Document
  fileUrl: string | null
}) {
  if (document.type === 'pdf') {
    if (!fileUrl) {
      return <MissingFile message="Original PDF is not available." />
    }
    return (
      <iframe
        title={getDisplayName(document)}
        src={fileUrl}
        className="h-full min-h-[60vh] w-full rounded-lg border border-border bg-surface"
      />
    )
  }

  if (document.type === 'image') {
    if (!fileUrl) {
      return <MissingFile message="Original image is not available." />
    }
    return (
      <div className="flex h-full items-center justify-center">
        <img
          src={fileUrl}
          alt={getDisplayName(document)}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
      </div>
    )
  }

  if (document.type === 'note') {
    const text = document.noteContent || document.extractedText || ''
    if (!text.trim()) {
      return <MissingFile message="This note has no content." />
    }
    return (
      <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-surface p-4 text-sm text-text font-sans leading-relaxed">
        {text}
      </pre>
    )
  }

  if (document.type === 'video') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        {document.videoThumbnail ? (
          <img
            src={document.videoThumbnail}
            alt={getDisplayName(document)}
            className="max-h-72 rounded-lg object-cover"
          />
        ) : null}
        <p className="text-sm text-text-muted">
          {document.videoChannel
            ? `${document.videoChannel}${document.videoDuration ? ` · ${document.videoDuration}` : ''}`
            : 'YouTube video'}
        </p>
        {document.videoUrl ? (
          <a
            href={document.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-surface hover:bg-primary-700"
          >
            Open on YouTube
          </a>
        ) : (
          <MissingFile message="Video link is not available." />
        )}
      </div>
    )
  }

  return <MissingFile message="Preview is not available for this file type." />
}

function MissingFile({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[12rem] items-center justify-center">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  )
}

export default MemoryPreviewModal
