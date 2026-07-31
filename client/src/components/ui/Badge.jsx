import { cn } from '../../utils/cn'

function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-background text-text-muted border border-border',
    primary: 'bg-primary-50 text-primary-700 border border-primary-100',
    success: 'bg-success/10 text-success border border-success/20',
    warning: 'bg-warning/10 text-warning border border-warning/20',
    danger: 'bg-danger/10 text-danger border border-danger/20',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

export default Badge
