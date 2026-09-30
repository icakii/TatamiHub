import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function HubLayout() {
  const { session, signOut } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <Link to="/" className="font-display text-sm uppercase tracking-[3px] text-straw">
          Tatami Hub
        </Link>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>{session?.user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="font-display uppercase tracking-wide text-hanko-text"
          >
            Log out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
