function EmptyState({ title, description, icon, action }) {
  return (
    <section className="text-center py-12 px-4" aria-label={title}>
      {icon && (
        <div className="mb-4 flex justify-center text-gray-400" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      {description && (
        <p className="text-sm text-text-muted mt-1 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </section>
  )
}

export default EmptyState
