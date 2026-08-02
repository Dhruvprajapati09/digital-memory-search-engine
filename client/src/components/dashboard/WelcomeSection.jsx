import { Link } from 'react-router-dom'
import Button from '../ui/Button'

function WelcomeSection({ name, readyCount }) {
  const count = readyCount ?? 0
  const memoryLabel = count === 1 ? 'memory' : 'memories'

  return (
    <section aria-labelledby="dashboard-welcome-heading">
      <h1
        id="dashboard-welcome-heading"
        className="text-2xl sm:text-3xl font-semibold text-text"
      >
        Welcome Back, {name}
      </h1>
      <p className="text-sm sm:text-base text-text-muted mt-2">
        You have {count} {memoryLabel} ready for AI search.
      </p>

      <div className="flex flex-wrap gap-3 mt-5">
        <Link to="/dashboard/upload">
          <Button>Upload Memory</Button>
        </Link>
        <Link to="/dashboard/assistant">
          <Button variant="secondary">Ask AI</Button>
        </Link>
        <Link to="/dashboard/search">
          <Button variant="secondary">Search</Button>
        </Link>
      </div>
    </section>
  )
}

export default WelcomeSection
