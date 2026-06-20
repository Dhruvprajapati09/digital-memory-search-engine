import { cn } from '../../utils/cn'

function Spinner({ size = 'md', inline = false, label = 'Loading' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
  }

  return (
    <div
      role="status"
      aria-label={label}
      className={cn(!inline && 'flex justify-center items-center py-8')}
    >
      <div
        className={cn(
          'border-primary-200 border-t-primary-600 rounded-full animate-spin',
          sizes[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default Spinner
