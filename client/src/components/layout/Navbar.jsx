import { useAuth } from '../../hooks/useAuth'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'

function Navbar({ onMenuClick, onToggleCollapse, collapsed }) {
  const { user, logout } = useAuth()

  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden !px-2"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="hidden md:inline-flex !px-2"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
          </svg>
        </Button>
        <span className="font-bold text-lg text-gray-900">MemoryEngine</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-sm text-text-muted">{user?.name || user?.email}</span>
        <Avatar name={user?.name || user?.email} size="sm" />
        <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
          Log out
        </Button>
      </div>
    </header>
  )
}

export default Navbar
