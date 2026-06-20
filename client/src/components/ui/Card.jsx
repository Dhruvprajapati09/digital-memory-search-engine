import { cn } from '../../utils/cn'

function Card({ children, className = '', as: Component = 'div', ...rest }) {
  return (
    <Component
      className={cn(
        'bg-surface rounded-xl shadow-sm border border-border p-6',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  )
}

export default Card
