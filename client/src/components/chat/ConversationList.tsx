import Button from '../ui/Button'
import type { ConversationSummary } from '../../types/chat'
import { cn } from '../../utils/cn'

interface ConversationListProps {
  conversations: ConversationSummary[]
  activeId: string | null
  creating?: boolean
  deletingId?: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
}

function ConversationList({
  conversations,
  activeId,
  creating = false,
  deletingId = null,
  onSelect,
  onNewChat,
  onDelete,
}: ConversationListProps) {
  return (
    <aside className="flex flex-col gap-3 w-full md:w-64 shrink-0">
      <Button
        onClick={onNewChat}
        loading={creating}
        className="w-full"
        aria-label="New chat"
      >
        New chat
      </Button>

      <div className="flex flex-col gap-1 max-h-40 md:max-h-none md:flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-sm text-text-muted px-1 py-2">No chats yet</p>
        ) : (
          conversations.map((chat) => {
            const isDeleting = deletingId === chat._id

            return (
              <div
                key={chat._id}
                className={cn(
                  'group flex items-center gap-1 rounded-lg pr-1',
                  activeId === chat._id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-text hover:bg-border/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(chat._id)}
                  disabled={isDeleting}
                  className={cn(
                    'flex-1 min-w-0 text-left px-3 py-2 text-sm truncate',
                    activeId === chat._id && 'font-medium',
                  )}
                  title={chat.title}
                >
                  {chat.title}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(chat._id)
                  }}
                  disabled={isDeleting}
                  aria-label={`Delete ${chat.title}`}
                  title="Delete chat"
                  className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

export default ConversationList
