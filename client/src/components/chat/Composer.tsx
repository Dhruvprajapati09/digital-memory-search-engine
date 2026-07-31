import { useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import Button from '../ui/Button'

interface ComposerProps {
  disabled?: boolean
  loading?: boolean
  initialDraft?: string
  onSend: (question: string) => void | Promise<void>
}

function Composer({
  disabled = false,
  loading = false,
  initialDraft = '',
  onSend,
}: ComposerProps) {
  const [draft, setDraft] = useState(initialDraft)

  useEffect(() => {
    if (initialDraft) setDraft(initialDraft)
  }, [initialDraft])

  const submit = async () => {
    const trimmed = draft.trim()
    if (!trimmed || disabled || loading) return
    try {
      await onSend(trimmed)
      setDraft('')
    } catch {
      // Keep draft so the user can retry after an error
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-surface pt-3"
    >
      <div className="flex gap-2 items-end">
        <label className="sr-only" htmlFor="assistant-question">
          Ask a question
        </label>
        <textarea
          id="assistant-question"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          placeholder="Ask a question about your documents…"
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        />
        <Button
          type="submit"
          onClick={() => undefined}
          loading={loading}
          disabled={disabled || !draft.trim()}
          aria-label="Send question"
        >
          Send
        </Button>
      </div>
    </form>
  )
}

export default Composer
