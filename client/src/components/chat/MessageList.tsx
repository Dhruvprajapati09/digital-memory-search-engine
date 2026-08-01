import type { ChatMessage } from '../../types/chat'
import SourceList from './SourceList'
import AssistantAnswer from './AssistantAnswer'

interface MessageListProps {
  messages: ChatMessage[]
  asking?: boolean
}

function MessageList({ messages, asking = false }: MessageListProps) {
  if (!messages.length && !asking) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12 text-center">
        <div>
          <h2 className="text-lg font-semibold text-text">Ask about your documents</h2>
          <p className="mt-1 text-sm text-text-muted max-w-sm mx-auto">
            Start a conversation to get answers from your uploaded files.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 px-1 py-2">
      {messages.map((message) => {
        const isUser = message.role === 'user'

        return (
          <div
            key={message._id}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-3 text-sm break-words ${
                isUser
                  ? 'bg-primary-600 text-white whitespace-pre-wrap'
                  : 'bg-surface border border-border text-text'
              }`}
            >
              {isUser ? (
                <p>{message.content}</p>
              ) : (
                <>
                  <AssistantAnswer content={message.content} />
                  <SourceList sources={message.sources ?? []} />
                </>
              )}
            </div>
          </div>
        )
      })}

      {asking ? (
        <div className="flex justify-start">
          <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-muted">
            Thinking…
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default MessageList
