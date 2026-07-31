import type { DocumentMatchMode, SearchOptions } from '../types/search'
import { cn } from '../utils/cn'

interface SearchOptionsPanelProps {
  value: SearchOptions
  onChange: (options: SearchOptions) => void
  className?: string
}

function SearchOptionsPanel({
  value,
  onChange,
  className = '',
}: SearchOptionsPanelProps) {
  const matchMode: DocumentMatchMode = value.matchMode ?? 'phrase'

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-4 p-4 bg-surface border border-border rounded-xl',
        className,
      )}
    >
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label htmlFor="match-mode" className="text-xs font-medium text-text-muted">
          Match mode
        </label>
        <select
          id="match-mode"
          value={matchMode}
          onChange={(e) =>
            onChange({
              ...value,
              matchMode: e.target.value as DocumentMatchMode,
            })
          }
          className="rounded-lg border border-border px-3 py-2 text-sm bg-surface focus:ring-2 focus:ring-primary-500"
        >
          <option value="phrase">Phrase</option>
          <option value="keyword">Keyword</option>
        </select>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-text mt-5 sm:mt-0">
        <input
          type="checkbox"
          checked={Boolean(value.caseSensitive)}
          onChange={(e) =>
            onChange({ ...value, caseSensitive: e.target.checked })
          }
          className="rounded border-border text-primary-600 focus:ring-primary-500"
        />
        Case sensitive
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-text mt-5 sm:mt-0">
        <input
          type="checkbox"
          checked={Boolean(value.wholeWord)}
          onChange={(e) =>
            onChange({ ...value, wholeWord: e.target.checked })
          }
          className="rounded border-border text-primary-600 focus:ring-primary-500"
        />
        Whole word
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-text mt-5 sm:mt-0">
        <input
          type="checkbox"
          checked={Boolean(value.prefix)}
          onChange={(e) => onChange({ ...value, prefix: e.target.checked })}
          className="rounded border-border text-primary-600 focus:ring-primary-500"
        />
        Prefix
      </label>
    </div>
  )
}

export default SearchOptionsPanel
