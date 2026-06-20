import { cn } from '../../utils/cn'

function Avatar({ name, src, size = 'md', className = '' }) {
  const initials = name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }

  return (
    <div
      className={cn(
        'rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center overflow-hidden shrink-0',
        sizes[size],
        className,
      )}
      role="img"
      aria-label={name ? `Avatar for ${name}` : 'User avatar'}
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        initials || '?'
      )}
    </div>
  )
}

export default Avatar
