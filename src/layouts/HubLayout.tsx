import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function HubLayout() {
  const { session, signOut } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-display text-sm uppercase tracking-[3px] text-straw">
            Tatami Hub
          </Link>
          <nav className="flex gap-4 font-display text-xs uppercase tracking-wide">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? 'text-hanko-text' : 'text-muted')}
            >
              Clubs
            </NavLink>
            <NavLink
              to="/billing"
              className={({ isActive }) => (isActive ? 'text-hanko-text' : 'text-muted')}
            >
              Billing
            </NavLink>
          </nav>
        </div>
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
