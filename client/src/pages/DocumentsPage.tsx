import { useState } from 'react'
import { Link } from 'react-router-dom'
import UploadForm from '../components/UploadForm'
import NoteForm from '../components/NoteForm'
import VideoForm from '../components/VideoForm'
import Toast, { type ToastMessage } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import type { Document } from '../types/document'

function DocumentsPage() {
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ id: Date.now(), type, message })
  }

  const handleDocumentAdded = (_document: Document) => {
    // Forms also call onSuccess with their own toast message.
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text mb-2">
            Upload
          </h1>
          <p className="text-sm text-text-muted">
            Upload PDFs and images, save text notes, import YouTube videos.
          </p>
        </div>
        <Link to="/dashboard/memories">
          <Button
            variant="secondary"
            onClick={() => undefined}
            aria-label="View all memories"
          >
            View all memories
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <UploadForm
          onUploaded={handleDocumentAdded}
          onSuccess={(msg) => showToast('success', msg)}
          onError={(msg) => showToast('error', msg)}
        />
        <NoteForm
          onCreated={handleDocumentAdded}
          onSuccess={(msg) => showToast('success', msg)}
          onError={(msg) => showToast('error', msg)}
        />
      </div>

      <div className="mb-8 max-w-xl">
        <VideoForm
          onCreated={handleDocumentAdded}
          onSuccess={(msg) => showToast('success', msg)}
          onError={(msg) => showToast('error', msg)}
        />
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default DocumentsPage
