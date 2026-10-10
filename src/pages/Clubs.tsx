import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CreateClubModal } from '../components/clubs/CreateClubModal'
import { PageTitle, StatusBadge } from '../components/ui'
import { useBilling } from '../hooks/useBilling'
import { useClubs } from '../hooks/useClubs'

export function Clubs() {
  const { data: clubs, isLoading } = useClubs()
  const { data: billing } = useBilling()
  const [showCreate, setShowCreate] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  const billingByClub = new Map((billing ?? []).map((b) => [b.club_id, b]))

  return (
    <div className="px-6 py-8">
      <PageTitle
        title="Clubs"
        subtitle={clubs ? `${clubs.length} club${clubs.length === 1 ? '' : 's'} on the platform` : undefined}
      >
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="min-h-11 rounded-md bg-hanko px-4 font-display text-sm uppercase tracking-wide text-text transition-transform hover:-translate-y-0.5"
        >
          + New club
        </button>
      </PageTitle>

      {isLoading && <p className="mt-6 text-muted">...</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clubs?.map((club) => {
          const b = billingByClub.get(club.id)
          const overdue = b ? !b.paid_until || b.paid_until < today : false
          return (
            <Link
              key={club.id}
              to={`/clubs/${club.id}`}
              className="group rounded-lg border border-line bg-panel p-5 transition-all hover:-translate-y-0.5 hover:border-straw/40 hover:bg-raised"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-raised font-display text-lg uppercase text-straw ring-1 ring-line">
                    {club.name.charAt(0)}
                  </span>
                  <div>
                    <p className="font-medium text-text">{club.name}</p>
                    <p className="font-mono text-xs text-muted">{club.slug}</p>
                  </div>
                </div>
                <StatusBadge status={club.status} />
              </div>
              {b && (
                <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-xs">
                  <span className="text-muted">{(b.monthly_price_cents / 100).toFixed(2)} EUR / mo</span>
                  <span className={overdue ? 'text-hanko-text' : 'text-sage'}>
                    {b.paid_until ? `paid until ${b.paid_until}` : 'never paid'}
                  </span>
                </div>
              )}
              <p className="mt-3 text-right text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100">
                Open →
              </p>
            </Link>
          )
        })}
      </div>

      {showCreate && <CreateClubModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
