import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'

function Memories() {
  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Memories</h1>
      <p className="text-sm text-text-muted mb-6">
        Browse and manage all your saved memories.
      </p>

      <EmptyState
        title="No memories found"
        description="Upload notes, links, or documents to build your memory library."
        icon={
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        action={<Button>Upload a memory</Button>}
      />
    </div>
  )
}

export default Memories
