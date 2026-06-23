import { useEffect, useId, useRef } from 'react'
import { cn } from '../utils/cn'
import Button from './ui/Button'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (query: string) => void
  onClear?: () => void
  placeholder?: string
  loading?: boolean
  autoFocus?: boolean
  className?: string
}

function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = 'What do you remember about...',
  loading = false,
  autoFocus = true,
  className = '',
}: SearchBarProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [autoFocus])

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(value.trim())
      }}
      className={cn('flex flex-col sm:flex-row gap-2 w-full', className)}
    >
      <div className="relative flex-1">
        <label htmlFor={id} className="sr-only">
          Search your memories
        </label>
        <input
          ref={inputRef}
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          className={cn(
            'w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl bg-white',
            'focus:outline-none focus:ring-2 focus:ring-primary-500',
            'disabled:opacity-60',
          )}
        />
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          aria-hidden="true"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </span>
        {value && onClear && !loading && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <Button type="submit" loading={loading} disabled={!value.trim()}>
        Search
      </Button>
    </form>
  )
}

export default SearchBar
