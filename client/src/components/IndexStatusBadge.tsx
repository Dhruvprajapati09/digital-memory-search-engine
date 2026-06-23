import type { IndexStatus } from '../types/document'
import Badge from './ui/Badge'

interface IndexStatusBadgeProps {
  status: IndexStatus
  className?: string
}

const STATUS_CONFIG: Record<
  IndexStatus,
  { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' }
> = {
  pending: { label: 'Pending', variant: 'warning' },
  processing: { label: 'Processing', variant: 'primary' },
  indexed: { label: 'Indexed', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
}

function IndexStatusBadge({ status, className = '' }: IndexStatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}

export default IndexStatusBadge
