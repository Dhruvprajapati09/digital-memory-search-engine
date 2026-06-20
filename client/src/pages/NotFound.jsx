import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-background">
      <p className="text-6xl font-bold text-primary-600" aria-hidden="true">
        404
      </p>
      <h1 className="text-2xl font-semibold text-gray-900 mt-4">Page not found</h1>
      <p className="text-text-muted mt-2 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link to="/dashboard" className="mt-6">
        <Button>Go to Dashboard</Button>
      </Link>
    </div>
  )
}

export default NotFound
