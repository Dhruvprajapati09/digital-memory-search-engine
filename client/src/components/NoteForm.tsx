import { useState, FormEvent } from 'react'
import Button from './ui/Button'
import Input from './ui/Input'
import Card from './ui/Card'
import { createNote } from '../services/documentService'
import type { Document } from '../types/document'

interface NoteFormProps {
  onCreated: (document: Document) => void
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

function NoteForm({ onCreated, onError, onSuccess }: NoteFormProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!title.trim()) {
      setError('Title is required.')
      return
    }

    if (!content.trim()) {
      setError('Note content cannot be empty.')
      return
    }

    setLoading(true)

    try {
      const document = await createNote(title.trim(), content.trim())
      onCreated(document)
      onSuccess('Note saved successfully!')
      setSuccess('Note saved successfully!')
      setTitle('')
      setContent('')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save note. Please try again.'
      setError(message)
      onError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-text mb-1">Save Note</h2>
      <p className="text-sm text-text-muted mb-4">
        Write and save text notes to your document library.
      </p>

      <form onSubmit={handleSubmit}>
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting Notes"
          required
        />

        <div className="mb-4">
          <label
            htmlFor="note-content"
            className="block text-sm font-medium text-text mb-1"
          >
            Content
            <span className="text-danger ml-1" aria-hidden="true">*</span>
          </label>
          <textarea
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Today I learned..."
            rows={5}
            required
            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text placeholder:text-text-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger mb-3">{error}</p>
        )}
        {success && (
          <p role="status" className="text-sm text-success mb-3">{success}</p>
        )}

        <Button type="submit" loading={loading}>
          Save Note
        </Button>
      </form>
    </Card>
  )
}

export default NoteForm
