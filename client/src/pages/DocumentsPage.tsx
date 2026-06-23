import { useState } from 'react'
import UploadForm from '../components/UploadForm'
import NoteForm from '../components/NoteForm'
import DocumentList from '../components/DocumentList'
import Toast, { type ToastMessage } from '../components/ui/Toast'
import type { Document } from '../types/document'

function DocumentsPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ id: Date.now(), type, message })
  }

  const handleDocumentAdded = (_document: Document) => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Documents</h1>
      <p className="text-sm text-text-muted mb-6">
        Upload PDFs and images, save text notes, and manage your personal documents.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Documents</h2>
      <DocumentList
        refreshKey={refreshKey}
        onToast={showToast}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default DocumentsPage
