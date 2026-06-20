import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

function Upload() {
  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Upload</h1>
      <p className="text-sm text-text-muted mb-6">
        Add notes, documents, links, or videos to your memory library.
      </p>

      <Card className="max-w-2xl border-dashed border-2 text-center py-12">
        <EmptyState
          title="Drop files here"
          description="Drag and drop files, or click to browse. Supports PDF, TXT, MD, and URLs."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          }
          action={<Button>Browse files</Button>}
        />
      </Card>
    </div>
  )
}

export default Upload
