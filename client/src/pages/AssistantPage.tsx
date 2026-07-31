import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ConversationList from '../components/chat/ConversationList'
import MessageList from '../components/chat/MessageList'
import Composer from '../components/chat/Composer'
import Spinner from '../components/ui/Spinner'
import {
  askInConversation,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
} from '../services/chatService'
import type { ChatMessage, ConversationSummary } from '../types/chat'

function AssistantPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [composerDraft, setComposerDraft] = useState('')
  const skipNextLoadRef = useRef(false)
  const seededFromQueryRef = useRef(false)

  const documentTitle = searchParams.get('title')

  useEffect(() => {
    if (seededFromQueryRef.current) return
    if (!documentTitle) return

    seededFromQueryRef.current = true
    setComposerDraft(`Regarding “${documentTitle}”: `)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('documentId')
        next.delete('title')
        return next
      },
      { replace: true },
    )
  }, [documentTitle, setSearchParams])

  const refreshList = useCallback(async () => {
    const data = await listConversations()
    setConversations(data.conversations)
    return data.conversations
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      setListLoading(true)
      setError(null)
      try {
        const list = await refreshList()
        if (cancelled) return

        if (list.length > 0) {
          setActiveId(list[0]._id)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chats')
        }
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [refreshList])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }

    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false
      return
    }

    let cancelled = false

    async function loadThread(id: string) {
      setThreadLoading(true)
      setError(null)
      try {
        const data = await getConversation(id)
        if (!cancelled) {
          setMessages(data.conversation.messages)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load conversation',
          )
          setMessages([])
        }
      } finally {
        if (!cancelled) setThreadLoading(false)
      }
    }

    void loadThread(activeId)
    return () => {
      cancelled = true
    }
  }, [activeId])

  const handleSelect = (id: string) => {
    skipNextLoadRef.current = false
    setActiveId(id)
  }

  const handleNewChat = async () => {
    setCreating(true)
    setError(null)
    try {
      const data = await createConversation()
      await refreshList()
      skipNextLoadRef.current = true
      setActiveId(data.conversation._id)
      setMessages([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chat')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Delete this chat? This cannot be undone.')
    if (!confirmed) return

    setDeletingId(id)
    setError(null)
    try {
      await deleteConversation(id)
      const list = await refreshList()

      if (activeId === id) {
        if (list.length > 0) {
          setActiveId(list[0]._id)
        } else {
          setActiveId(null)
          setMessages([])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chat')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSend = async (question: string) => {
    setError(null)

    let conversationId = activeId

    try {
      if (!conversationId) {
        setCreating(true)
        const created = await createConversation()
        conversationId = created.conversation._id
        skipNextLoadRef.current = true
        setActiveId(conversationId)
        setMessages([])
        await refreshList()
        setCreating(false)
      }

      setAsking(true)
      const result = await askInConversation(conversationId, question)
      setMessages((prev) => [
        ...prev,
        result.userMessage,
        result.assistantMessage,
      ])
      setComposerDraft('')
      await refreshList()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to get an answer'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setAsking(false)
      setCreating(false)
    }
  }

  const composerKey = useMemo(
    () => (composerDraft ? `seeded-${composerDraft}` : 'default'),
    [composerDraft],
  )

  if (listLoading) {
    return <Spinner label="Loading assistant" />
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] min-h-[28rem]">
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-semibold text-text">
          AI Memory Assistant
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Ask questions about your uploaded documents.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          creating={creating}
          deletingId={deletingId}
          onSelect={handleSelect}
          onNewChat={handleNewChat}
          onDelete={handleDelete}
        />

        <section className="flex-1 flex flex-col min-h-0 rounded-xl border border-border bg-surface p-4">
          {error ? (
            <div
              role="alert"
              className="mb-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
            >
              {error}
            </div>
          ) : null}

          {threadLoading ? (
            <Spinner label="Loading conversation" />
          ) : (
            <MessageList messages={messages} asking={asking} />
          )}

          <Composer
            key={composerKey}
            initialDraft={composerDraft}
            onSend={handleSend}
            loading={asking}
            disabled={threadLoading}
          />
        </section>
      </div>
    </div>
  )
}

export default AssistantPage
