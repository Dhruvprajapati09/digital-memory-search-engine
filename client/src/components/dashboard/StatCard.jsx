import Card from '../ui/Card'
import { cn } from '../../utils/cn'

function StatCard({ label, value, icon, className = '' }) {
  return (
    <Card
      className={cn(
        'flex items-center gap-4 min-h-[108px] h-full transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="p-3 rounded-lg bg-primary-50 text-primary-600 border border-border shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl sm:text-3xl font-semibold text-text font-display tabular-nums leading-tight">
          {value}
        </p>
        <p className="text-sm text-text-muted mt-0.5">{label}</p>
      </div>
    </Card>
  )
}

export default StatCard
