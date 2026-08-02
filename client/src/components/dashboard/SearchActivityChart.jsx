import { useState } from 'react'
import Card from '../ui/Card'
import { MOCK_SEARCH_ACTIVITY } from './mockDashboardData'

function SearchActivityChart({ data }) {
  // TODO: Replace MOCK_SEARCH_ACTIVITY default with daily search analytics API data.
  const series = Array.isArray(data) && data.length > 0 ? data : MOCK_SEARCH_ACTIVITY
  const maxCount = Math.max(...series.map((d) => d.count), 1)
  const [hovered, setHovered] = useState(null)

  return (
    <Card className="h-full min-h-[280px] flex flex-col transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center gap-2 mb-5">
        <svg
          className="w-5 h-5 text-primary-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M7 12l3-3 3 3 4-4M8 21H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v14a2 2 0 01-2 2h-4"
          />
        </svg>
        <h2 className="text-lg font-semibold text-text">
          Search Activity (Last 7 Days)
        </h2>
      </div>

      <div className="relative flex-1 flex flex-col justify-end">
        <div
          className="flex items-end justify-between gap-2 sm:gap-3 h-40"
          role="img"
          aria-label="Search activity for the last 7 days"
        >
          {series.map((item) => {
            const heightPct = Math.max((item.count / maxCount) * 100, 6)
            const isActive = hovered === item.day

            return (
              <div
                key={item.day}
                className="relative flex-1 flex flex-col items-center gap-2 h-full justify-end"
                onMouseEnter={() => setHovered(item.day)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(item.day)}
                onBlur={() => setHovered(null)}
              >
                {isActive && (
                  <div
                    role="tooltip"
                    className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-text text-surface text-xs px-2 py-1 shadow-sm z-10"
                  >
                    {item.day}: {item.count} search{item.count === 1 ? '' : 'es'}
                  </div>
                )}
                <button
                  type="button"
                  className="w-full max-w-[40px] mx-auto rounded-t-md bg-primary-500 hover:bg-primary-600 focus-visible:bg-primary-600 transition-all duration-200 ease-out origin-bottom"
                  style={{ height: `${heightPct}%` }}
                  aria-label={`${item.day}: ${item.count} searches`}
                />
                <span className="text-xs text-text-muted font-medium">
                  {item.day}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

export default SearchActivityChart
