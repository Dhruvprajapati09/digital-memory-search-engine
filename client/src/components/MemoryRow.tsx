import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Document, DocumentType } from '../types/document'
import { getFileUrl } from '../services/documentService'
import { cn } from '../utils/cn'
import {
  buildMetaSegments,
  formatRelativeUploadDate,
  getDisplayName,
  getTypeBadge,
} from '../utils/memoryLibrary'

interface MemoryRowProps {
  document: Document
  favorited: boolean
  onToggleFavorite: (id: string) => void
  onPreview: (document: Document) => void
  onDelete: (document: Document) => void
}

const BADGE_STYLES: Record<DocumentType, string> = {
  pdf: 'bg-primary-50 text-primary-700 border-primary-100',
  note: 'bg-amber-50 text-amber-700 border-amber-100',
  image: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  video: 'bg-rose-50 text-rose-700 border-rose-100',
}

function MemoryRow({
  document,
  favorited,
  onToggleFavorite,
  onPreview,
  onDelete,
}: MemoryRowProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const displayName = getDisplayName(document)
  const meta = buildMetaSegments(document)
  const fileUrl = getFileUrl(document)

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.document.addEventListener('mousedown', handlePointerDown)
    window.document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.document.removeEventListener('mousedown', handlePointerDown)
      window.document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const handleDownload = () => {
    if (!fileUrl) return
    const anchor = window.document.createElement('a')
    anchor.href = fileUrl
    anchor.download = document.originalFileName || displayName
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    window.document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const handleAskAi = () => {
    const params = new URLSearchParams({
      documentId: document.id,
      title: displayName,
    })
    navigate(`/dashboard/assistant?${params.toString()}`)
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onPreview(document)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPreview(document)
        }
      }}
      className={cn(
        'group flex gap-3 rounded-xl border border-border bg-surface px-4 py-3',
        'hover:bg-border/20 hover:border-primary-200 transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
      )}
    >
      <div
        className={cn(
          'shrink-0 self-start mt-0.5 w-11 text-center text-[11px] font-semibold tracking-wide',
          'rounded-md border px-1.5 py-1',
          BADGE_STYLES[document.type],
        )}
      >
        {getTypeBadge(document.type)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 min-w-0 font-medium text-text truncate">
            {displayName}
          </h3>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={favorited}
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite(document.id)
              }}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                favorited
                  ? 'text-amber-500 hover:bg-amber-50'
                  : 'text-text-muted/40 hover:text-amber-500 hover:bg-border/40',
              )}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill={favorited ? 'currentColor' : 'none'}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label={`Actions for ${displayName}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen((open) => !open)
                }}
                className="rounded-md p-1.5 text-text-muted hover:bg-border/40 hover:text-text transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8a2 2 0 100-4 2 2 0 000 4zm0 2a2 2 0 100 4 2 2 0 000-4zm0 6a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-surface py-1 shadow-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MenuItem
                    label="Preview"
                    onClick={() => {
                      setMenuOpen(false)
                      onPreview(document)
                    }}
                  />
                  <MenuItem
                    label="Ask AI"
                    onClick={() => {
                      setMenuOpen(false)
                      handleAskAi()
                    }}
                  />
                  <MenuItem
                    label="Download"
                    disabled={
                      !fileUrl &&
                      document.type !== 'note' &&
                      !(document.type === 'video' && document.videoUrl)
                    }
                    onClick={() => {
                      setMenuOpen(false)
                      if (document.type === 'note') {
                        const blob = new Blob(
                          [document.noteContent || document.extractedText || ''],
                          { type: 'text/plain' },
                        )
                        const url = URL.createObjectURL(blob)
                        const a = window.document.createElement('a')
                        a.href = url
                        a.download = `${displayName}.txt`
                        a.click()
                        URL.revokeObjectURL(url)
                      } else if (document.type === 'video' && document.videoUrl) {
                        window.open(document.videoUrl, '_blank', 'noopener,noreferrer')
                      } else {
                        handleDownload()
                      }
                    }}
                  />
                  <MenuItem
                    label="Delete"
                    danger
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete(document)
                    }}
                  />
                  <div className="my-1 border-t border-border" />
                  <MenuItem label="Rename" disabled comingSoon />
                  <MenuItem label="Share" disabled comingSoon />
                  <MenuItem label="Edit Tags" disabled comingSoon />
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-0.5 text-sm text-text-muted">
          {formatRelativeUploadDate(document.createdAt)}
        </p>

        {meta.length > 0 && (
          <p className="mt-0.5 text-sm text-text-muted truncate">
            {meta.join(' • ')}
          </p>
        )}
      </div>
    </article>
  )
}

function MenuItem({
  label,
  onClick,
  disabled = false,
  danger = false,
  comingSoon = false,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  comingSoon?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors',
        danger ? 'text-danger hover:bg-danger/5' : 'text-text hover:bg-border/40',
        disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
      )}
    >
      <span>{label}</span>
      {comingSoon && (
        <span className="text-[10px] uppercase tracking-wide text-text-muted">
          Soon
        </span>
      )}
    </button>
  )
}

export default MemoryRow
