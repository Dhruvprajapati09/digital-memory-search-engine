import { useId } from 'react'
import { cn } from '../../utils/cn'

function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search memories...',
  loading = false,
  className = '',
}) {
  const id = useId()

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(value)
      }}
      className={cn('relative w-full', className)}
    >
      <label htmlFor={id} className="sr-only">
        Search
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          'w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-white',
          'focus:outline-none focus:ring-2 focus:ring-primary-500',
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
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
          Searching...
        </span>
      )}
    </form>
  )
}

export default SearchBar
