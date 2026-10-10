import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CreateClubModal } from '../components/clubs/CreateClubModal'
import { PageTitle, StatTile, StatusBadge } from '../components/ui'
import { useOrders, useUpdateOrder, type Order, type OrderStatus } from '../hooks/useOrders'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'awaiting payment',
  paid: 'paid',
  in_progress: 'in progress',
  live: 'live',
  cancelled: 'cancelled',
}

// Maps onto StatusBadge's color groups.
const BADGE: Record<OrderStatus, string> = {
  pending_payment: 'due',
  paid: 'paid',
  in_progress: 'trial',
  live: 'live',
  cancelled: 'left',
}

const DOMAIN_LABEL: Record<Order['domain_option'], string> = {
  subdomain: 'Tatami subdomain',
  own: 'Own domain (connect)',
  new: 'New domain (+10 EUR/mo)',
}

const FILTERS = ['active', 'all'] as const

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted">{label}</p>
      <div className="mt-0.5 truncate text-sm text-text">{children}</div>
    </div>
  )
}

export function Orders() {
  const { data: orders, isLoading } = useOrders()
  const updateOrder = useUpdateOrder()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('active')
  const [creatingFrom, setCreatingFrom] = useState<Order | null>(null)

  const all = orders ?? []
  const visible = filter === 'all' ? all : all.filter((o) => o.status !== 'cancelled')
  const toBuild = all.filter((o) => o.status === 'paid').length
  const inProgress = all.filter((o) => o.status === 'in_progress').length
  const awaiting = all.filter((o) => o.status === 'pending_payment').length

  return (
    <div className="px-6 py-8">
      <PageTitle title="Orders" subtitle="Placed and paid on the Tatami site. Paid orders are waiting for us to build the club.">
        <div className="flex gap-1 rounded-lg border border-line bg-panel p-1 font-display text-xs uppercase tracking-wider">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 uppercase transition-colors ${
                filter === f ? 'bg-raised text-text' : 'text-muted hover:text-text'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </PageTitle>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="To build" value={toBuild} accent="bg-hanko" hint="paid, nobody started yet" />
        <StatTile label="In progress" value={inProgress} accent="bg-straw" />
        <StatTile label="Awaiting payment" value={awaiting} accent="bg-sage" hint="started checkout, not paid" />
      </div>

      {isLoading && <p className="mt-6 text-muted">...</p>}
      {!isLoading && visible.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed border-line p-8 text-center text-muted">No orders yet.</p>
      )}

      <div className="mt-6 space-y-4">
        {visible.map((o) => (
          <div key={o.id} className="hub-enter rounded-lg border border-line bg-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold uppercase tracking-wide text-text">{o.club_name}</p>
                <p className="text-xs text-muted">
                  {new Date(o.created_at).toLocaleString()} · {o.city ?? 'no city'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={BADGE[o.status]} label={STATUS_LABEL[o.status]} />
                {o.cancel_at && <StatusBadge status="overdue" label={`ends ${o.cancel_at}`} />}
              </div>
            </div>

            <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Contact">{o.contact_name}</Detail>
              <Detail label="Email">
                <a href={`mailto:${o.email}`} className="hover:text-hanko-text">
                  {o.email}
                </a>
              </Detail>
              <Detail label="Phone">{o.phone ? <a href={`tel:${o.phone}`}>{o.phone}</a> : '-'}</Detail>
              <Detail label="Students">{o.student_count ?? '-'}</Detail>
              <Detail label="Address">{DOMAIN_LABEL[o.domain_option]}</Detail>
              <Detail label="Domain">{o.domain ?? '-'}</Detail>
              <Detail label="Paid until">
                <span className={o.paid_until ? 'text-sage' : 'text-muted'}>{o.paid_until ?? 'not paid'}</span>
              </Detail>
              <Detail label="Paddle">
                <span className="font-mono text-xs">{o.paddle_subscription_id ?? '-'}</span>
              </Detail>
            </div>

            {o.notes && (
              <p className="mt-4 whitespace-pre-wrap rounded-md border border-line bg-ink/40 p-3 text-sm text-muted">{o.notes}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {o.club_id ? (
                <Link
                  to={`/clubs/${o.club_id}`}
                  className="min-h-9 rounded-md border border-line px-3 py-2 text-xs uppercase tracking-wide text-text hover:border-straw/50"
                >
                  Open club →
                </Link>
              ) : (
                o.status !== 'cancelled' &&
                o.status !== 'pending_payment' && (
                  <button
                    type="button"
                    onClick={() => setCreatingFrom(o)}
                    className="min-h-9 rounded-md bg-hanko px-3 text-xs uppercase tracking-wide text-text"
                  >
                    Create club from order
                  </button>
                )
              )}
              {o.status === 'in_progress' && (
                <button
                  type="button"
                  onClick={() => updateOrder.mutate({ id: o.id, updates: { status: 'live' } })}
                  className="min-h-9 rounded-md border border-line px-3 text-xs uppercase tracking-wide text-sage"
                >
                  Mark live
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {creatingFrom && (
        <CreateClubModal
          initial={{
            name: creatingFrom.club_name,
            hostname: creatingFrom.domain_option === 'subdomain' ? undefined : (creatingFrom.domain ?? undefined),
            monthlyEur: creatingFrom.domain_option === 'new' ? 109 : 99,
          }}
          onCreated={(clubId) =>
            updateOrder.mutateAsync({ id: creatingFrom.id, updates: { club_id: clubId, status: 'in_progress' } })
          }
          onClose={() => setCreatingFrom(null)}
        />
      )}
    </div>
  )
}
