import { cn } from '../../utils/cn'
import Spinner from './Spinner'

function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  'aria-label': ariaLabel,
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-primary-600 text-surface hover:bg-primary-700 dark:text-background',
    secondary: 'bg-background text-text border border-border hover:bg-border/40',
    ghost: 'bg-transparent text-text-muted hover:bg-border/50 hover:text-text',
    danger: 'bg-danger text-white hover:opacity-90',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {loading && <Spinner size="sm" inline label="Loading" />}
      {children}
    </button>
  )
}

export default Button
