import type { DocumentType } from '../types/document'
import type { DateFilterPreset } from '../types/search'
import { cn } from '../utils/cn'

export interface SearchFiltersValue {
  type?: DocumentType
  date?: DateFilterPreset
  dateFrom?: string
  dateTo?: string
}

interface SearchFiltersProps {
  value: SearchFiltersValue
  onChange: (filters: SearchFiltersValue) => void
  className?: string
}

const TYPE_OPTIONS: Array<{ value: DocumentType | ''; label: string }> = [
  { value: '', label: 'All Types' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
  { value: 'note', label: 'Note' },
  { value: 'video', label: 'Video' },
]

const DATE_OPTIONS: Array<{ value: DateFilterPreset | ''; label: string }> = [
  { value: '', label: 'Any Time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
]

function SearchFilters({ value, onChange, className = '' }: SearchFiltersProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end gap-3 p-4 bg-surface border border-border rounded-xl',
        className,
      )}
    >
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label htmlFor="filter-type" className="text-xs font-medium text-text-muted">
          File Type
        </label>
        <select
          id="filter-type"
          value={value.type ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              type: (e.target.value || undefined) as DocumentType | undefined,
            })
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 min-w-[160px]">
        <label htmlFor="filter-date" className="text-xs font-medium text-text-muted">
          Date
        </label>
        <select
          id="filter-date"
          value={value.date ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              date: (e.target.value || undefined) as DateFilterPreset | undefined,
              dateFrom: e.target.value === 'custom' ? value.dateFrom : undefined,
              dateTo: e.target.value === 'custom' ? value.dateTo : undefined,
            })
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500"
        >
          {DATE_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {value.date === 'custom' && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-from" className="text-xs font-medium text-text-muted">
              From
            </label>
            <input
              id="filter-from"
              type="date"
              value={value.dateFrom ?? ''}
              onChange={(e) =>
                onChange({ ...value, dateFrom: e.target.value || undefined })
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-to" className="text-xs font-medium text-text-muted">
              To
            </label>
            <input
              id="filter-to"
              type="date"
              value={value.dateTo ?? ''}
              onChange={(e) =>
                onChange({ ...value, dateTo: e.target.value || undefined })
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </>
      )}
    </div>
  )
}

export default SearchFilters
