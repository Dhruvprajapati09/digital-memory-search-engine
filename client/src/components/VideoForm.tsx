import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Button from './ui/Button'
import Input from './ui/Input'
import Card from './ui/Card'
import {
  importYouTubeVideo,
  type YouTubeVideoSummary,
} from '../services/youtubeService'
import { fetchDocument } from '../services/documentService'
import type { Document } from '../types/document'

interface VideoFormProps {
  onCreated: (document: Document) => void
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

const SUPPORTED_FORMATS = [
  'youtube.com/watch',
  'youtu.be',
  'youtube.com/shorts',
]

type ImportState = 'idle' | 'fetching' | 'transcript' | 'indexing' | 'ready' | 'error'

const IMPORT_STEPS: Array<{
  state: Exclude<ImportState, 'idle' | 'ready' | 'error'>
  label: string
  description: string
}> = [
  {
    state: 'fetching',
    label: 'Fetching',
    description: 'Metadata',
  },
  {
    state: 'transcript',
    label: 'Transcript',
    description: 'Captions',
  },
  {
    state: 'indexing',
    label: 'Indexing',
    description: 'Search + Q&A',
  },
]

function extractYouTubeVideoId(rawUrl: string): string | null {
  if (!rawUrl.trim()) return null

  try {
    const parsed = new URL(rawUrl.trim())
    const host = parsed.hostname.toLowerCase()

    if (host === 'youtu.be' || host === 'www.youtu.be') {
      return normalizeVideoId(parsed.pathname.split('/').filter(Boolean)[0])
    }

    const isYouTubeHost = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'music.youtube.com',
    ].includes(host)

    if (!isYouTubeHost) return null

    const videoId = parsed.searchParams.get('v')
    if (videoId) return normalizeVideoId(videoId)

    const pathMatch = parsed.pathname.match(
      /^\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/,
    )

    return normalizeVideoId(pathMatch?.[1])
  } catch {
    return null
  }
}

function normalizeVideoId(value?: string | null): string | null {
  return value && /^[a-zA-Z0-9_-]{11}$/.test(value) ? value : null
}

function VideoForm({ onCreated, onError, onSuccess }: VideoFormProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [importState, setImportState] = useState<ImportState>('idle')
  const [importedVideo, setImportedVideo] = useState<YouTubeVideoSummary | null>(
    null,
  )

  const pastedVideoId = useMemo(() => extractYouTubeVideoId(url), [url])
  const hasUrl = url.trim().length > 0
  const urlError =
    hasUrl && !pastedVideoId
      ? 'Use a valid YouTube video, Shorts, live, embed, or youtu.be link.'
      : ''
  const thumbnailUrl = pastedVideoId
    ? `https://img.youtube.com/vi/${pastedVideoId}/hqdefault.jpg`
    : ''
  const currentStepIndex = IMPORT_STEPS.findIndex(
    (step) => step.state === importState,
  )
  const errorStepIndex = getErrorStepIndex(error)

  useEffect(() => {
    if (!loading) return undefined

    const transcriptTimer = window.setTimeout(() => {
      setImportState('transcript')
    }, 800)
    const indexingTimer = window.setTimeout(() => {
      setImportState('indexing')
    }, 2200)

    return () => {
      window.clearTimeout(transcriptTimer)
      window.clearTimeout(indexingTimer)
    }
  }, [loading])

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
    setError('')
    setSuccess('')
    setImportState('idle')
    setImportedVideo(null)
  }

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard?.readText) {
      setError('Clipboard paste is not available in this browser.')
      return
    }

    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
      setError('')
      setSuccess('')
      setImportState('idle')
      setImportedVideo(null)
    } catch {
      setError('Could not read from clipboard. Paste the URL manually.')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setImportState('idle')
    setImportedVideo(null)

    if (!url.trim()) {
      setError('YouTube URL is required.')
      return
    }

    if (!pastedVideoId) {
      setError('Enter a supported YouTube URL before importing.')
      return
    }

    setLoading(true)
    setImportState('fetching')

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
      setImportState('ready')
      setImportedVideo(result.video)
      setUrl('')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to import video.'
      setError(message)
      setImportState('error')
      onError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border bg-background px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-danger text-sm font-semibold text-white">
                YT
              </span>
              <h2 className="text-lg font-semibold text-text">
                Save YouTube Video
              </h2>
            </div>
            <p className="max-w-2xl text-sm text-text-muted">
              Turn a captioned video into searchable memory so you can ask
              questions and get answers from its transcript.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-text-muted">
            {SUPPORTED_FORMATS.map((format) => (
              <span
                key={format}
                className="rounded-full border border-border bg-surface px-2.5 py-1"
              >
                {format}
              </span>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div>
            <Input
              label="YouTube URL"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://www.youtube.com/watch?v=..."
              error={urlError}
              required
              autoComplete="off"
              className="mb-3"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handlePasteFromClipboard}
                disabled={loading}
              >
                Paste URL
              </Button>
              {hasUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUrl('')
                    setError('')
                    setSuccess('')
                    setImportState('idle')
                    setImportedVideo(null)
                  }}
                  disabled={loading}
                >
                  Clear
                </Button>
              )}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {IMPORT_STEPS.map((step, index) => (
                <div
                  key={step.state}
                  className={[
                    'rounded-lg border px-3 py-2 transition-colors',
                    currentStepIndex === index
                      ? 'border-primary-500 bg-primary-50'
                      : currentStepIndex > index || importState === 'ready'
                        ? 'border-success/40 bg-success/10'
                        : importState === 'error' && errorStepIndex === index
                          ? 'border-danger bg-danger/10'
                          : 'border-border bg-background',
                  ].join(' ')}
                >
                  <p className="text-xs font-medium text-text">
                    {index + 1}. {step.label}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-text-muted">
              Captions must be available. Videos without transcripts cannot be
              imported for answers.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-background">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt=""
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-surface">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger text-xs font-semibold text-white">
                  YT
                </div>
              </div>
            )}
            <div className="border-t border-border p-3">
              <p className="text-sm font-medium text-text">
                {importState === 'ready'
                  ? 'Ready for questions'
                  : importState === 'error'
                    ? 'Import needs attention'
                    : pastedVideoId
                      ? 'Ready to import video'
                      : 'Waiting for a link'}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {importState === 'ready'
                  ? 'Search and AI Q&A can now use this transcript.'
                  : importState === 'error'
                    ? 'Check captions availability or try another video.'
                    : pastedVideoId
                      ? 'Transcript indexing starts after import.'
                      : 'Paste a supported YouTube URL to preview it here.'}
              </p>
            </div>
          </div>
        </div>

        {error && !urlError && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}

        {success && importedVideo && (
          <div
            role="status"
            className="mt-5 rounded-lg border border-success/30 bg-success/10 p-4"
          >
            <p className="text-sm font-medium text-text">{success}</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">
                  {importedVideo.title}
                </p>
                <p className="text-xs text-text-muted">
                  {[
                    importedVideo.channel,
                    importedVideo.duration,
                    importedVideo.chunksIndexed
                      ? `${importedVideo.chunksIndexed} chunks`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' / ')}
                </p>
              </div>
              <Link
                to="/dashboard/memories"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text hover:bg-border/40"
              >
                View memories
              </Link>
            </div>
          </div>
        )}

        <Button
          type="submit"
          loading={loading}
          disabled={Boolean(urlError)}
          className="mt-5"
        >
          {loading ? 'Importing video' : 'Import Video'}
        </Button>
      </form>
    </Card>
  )
}

function getErrorStepIndex(message: string): number {
  const lower = message.toLowerCase()

  if (lower.includes('transcript') || lower.includes('caption')) {
    return 1
  }

  if (lower.includes('index')) {
    return 2
  }

  return 0
}

export default VideoForm
