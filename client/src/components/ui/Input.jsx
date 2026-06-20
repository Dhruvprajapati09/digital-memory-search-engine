import { useId } from 'react'
import { cn } from '../../utils/cn'

function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  id: externalId,
  required = false,
  autoComplete,
  rightElement,
  className = '',
  ...rest
}) {
  const generatedId = useId()
  const id = externalId || generatedId
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={cn('mb-4', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={cn(
            'w-full px-3 py-2 border rounded-lg bg-white transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error ? 'border-red-500' : 'border-gray-300',
            rightElement && 'pr-10',
          )}
          {...rest}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-500 mt-1">
          {error}
        </p>
      )}
    </div>
  )
}

export default Input
