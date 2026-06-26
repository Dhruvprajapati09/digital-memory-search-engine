import { useState, useRef, ChangeEvent, FormEvent } from 'react'
import Button from './ui/Button'
import Input from './ui/Input'
import Card from './ui/Card'
import { uploadDocument } from '../services/documentService'
import type { Document } from '../types/document'

interface UploadFormProps {
  onUploaded: (document: Document) => void
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

function UploadForm({ onUploaded, onError, onSuccess }: UploadFormProps) {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!file) {
      setError('Please select a supported file to upload.')
      return
    }

    setLoading(true)

    try {
      const document = await uploadDocument(file, title)
      onUploaded(document)
      onSuccess('File uploaded successfully!')
      setSuccess('File uploaded successfully!')
      setTitle('')
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setError(message)
      onError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Upload File</h2>
      <p className="text-sm text-text-muted mb-4">
        Upload PDF, image, text, Markdown, CSV, JSON, or HTML files (max 10 MB).
      </p>

      <form onSubmit={handleSubmit}>
        <Input
          label="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document title"
        />

        <div className="mb-4">
          <label
            htmlFor="file-upload"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            File
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.md,.markdown,.csv,.json,.html,.htm,application/pdf,image/*,text/*,application/json"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
          />
          {file && (
            <p className="text-xs text-text-muted mt-1">
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-500 mb-3">{error}</p>
        )}
        {success && (
          <p role="status" className="text-sm text-green-600 mb-3">{success}</p>
        )}

        <Button type="submit" loading={loading} disabled={!file}>
          Upload
        </Button>
      </form>
    </Card>
  )
}

export default UploadForm
