import { useState, FormEvent } from 'react'
import Button from './ui/Button'
import Input from './ui/Input'
import Card from './ui/Card'
import { importYouTubeVideo } from '../services/youtubeService'
import { fetchDocument } from '../services/documentService'
import type { Document } from '../types/document'

interface VideoFormProps {
  onCreated: (document: Document) => void
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

function VideoForm({ onCreated, onError, onSuccess }: VideoFormProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!url.trim()) {
      setError('YouTube URL is required.')
      return
    }

    setLoading(true)

    try {
      const result = await importYouTubeVideo(url.trim())

      if (result.video.documentId) {
        const document = await fetchDocument(result.video.documentId)
        onCreated(document)
      }

      const message = result.duplicate
        ? `"${result.video.title}" is already in your library.`
        : `Video imported with ${result.chunksIndexed} indexed chunks.`

      onSuccess(message)
      setSuccess(message)
      setUrl('')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to import video.'
      setError(message)
      onError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Save YouTube Video</h2>
      <p className="text-sm text-text-muted mb-4">
        Paste a YouTube URL to import its transcript into your searchable memory.
      </p>

      <form onSubmit={handleSubmit}>
        <Input
          label="YouTube URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          required
        />

        {error && (
          <p role="alert" className="text-sm text-red-500 mb-3">{error}</p>
        )}
        {success && (
          <p role="status" className="text-sm text-green-600 mb-3">{success}</p>
        )}

        <Button type="submit" loading={loading}>
          Import Video
        </Button>
      </form>
    </Card>
  )
}

export default VideoForm
