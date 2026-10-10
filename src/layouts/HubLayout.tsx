import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { SealMark } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { to: '/', end: true, label: 'Clubs' },
  { to: '/billing', end: false, label: 'Billing' },
  { to: '/orders', label: 'Orders', end: false },
]

export function HubLayout() {
  const { session, signOut } = useAuth()
  const location = useLocation()
  const email = session?.user.email ?? ''

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <SealMark />
              <span className="font-display text-sm font-semibold uppercase tracking-[0.3em] text-straw">
                Tatami Hub
              </span>
            </Link>
            <nav className="flex gap-1 font-display text-xs uppercase tracking-wider">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 transition-colors ${
                      isActive ? 'bg-raised text-text' : 'text-muted hover:text-text'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="hidden sm:inline">{email}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-raised font-display text-sm uppercase text-straw ring-1 ring-line">
              {email.charAt(0)}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-md px-2 py-1.5 font-display uppercase tracking-wide text-hanko-text transition-colors hover:bg-hanko/10"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main key={location.pathname} className="hub-enter mx-auto max-w-7xl">
        <Outlet />
      </main>
    </div>
  )
}
