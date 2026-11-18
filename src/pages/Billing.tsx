import { useBilling, useMarkPaid } from '../hooks/useBilling'
import { useUpdateClubStatus } from '../hooks/useClubs'
import { PageTitle, StatTile, StatusBadge } from '../components/ui'
import { localISODate } from '../lib/date'
import { useState } from 'react'

function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`
}

export function Billing() {
  const { data: rows, isLoading } = useBilling()
  const markPaid = useMarkPaid()
  const updateStatus = useUpdateClubStatus()
  const today = localISODate()
  const [method, setMethod] = useState<'bank' | 'cash' | 'card'>('bank')

  const live = (rows ?? []).filter((r) => r.club.status === 'live')
  const mrrCents = live.reduce((sum, r) => sum + r.monthly_price_cents, 0)
  const overdueCount = (rows ?? []).filter((r) => !r.paid_until || r.paid_until < today).length

  return (
    <div className="px-6 py-8">
      <PageTitle
        title="Billing"
        subtitle="What each club owes us. Clubs pay by bank, cash or card; Mark paid moves them a month ahead and books the income in Finance."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Monthly recurring" value={formatPrice(mrrCents)} accent="bg-sage" hint="from live clubs" />
        <StatTile label="Overdue" value={overdueCount} accent="bg-hanko" hint="clubs past their paid-until date" />
        <StatTile label="Live clubs" value={`${live.length} / ${rows?.length ?? 0}`} accent="bg-straw" />
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs text-muted">
        Mark paid as
        {(['bank', 'cash', 'card'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`rounded-full px-3 py-1 uppercase tracking-wide ${method === m ? 'bg-straw text-ink' : 'border border-line hover:text-text'}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-panel text-left text-xs uppercase tracking-wide text-muted">
              <th className="p-3">Club</th>
              <th className="p-3">Plan</th>
              <th className="p-3">First month</th>
              <th className="p-3">Monthly</th>
              <th className="p-3">Paid until</th>
              <th className="p-3">Site</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted">
                  ...
                </td>
              </tr>
            )}
            {rows?.map((row) => {
              const overdue = !row.paid_until || row.paid_until < today
              const suspended = row.club.status === 'paused'
              return (
                <tr key={row.club_id} className="border-b border-line last:border-0">
                  <td className="p-3 text-text">{row.club.name}</td>
                  <td className="p-3 capitalize text-muted">{row.plan}</td>
                  <td className="p-3 text-muted">
                    {row.first_month_price_cents ? formatPrice(row.first_month_price_cents) : '-'}
                  </td>
                  <td className="p-3 text-muted">{formatPrice(row.monthly_price_cents)}</td>
                  <td className="p-3">
                    <span className={overdue ? 'text-hanko-text' : 'text-sage'}>
                      {row.paid_until ?? 'never paid'}
                    </span>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={row.club.status} label={suspended ? 'Suspended' : row.club.status} />
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => markPaid.mutate({ clubId: row.club_id, method, amountCents: row.monthly_price_cents })}
                        disabled={markPaid.isPending}
                        className="min-h-11 rounded-md border border-line px-3 text-xs uppercase tracking-wide text-muted disabled:opacity-60"
                      >
                        Mark paid
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus.mutate({
                            clubId: row.club_id,
                            status: row.club.status === 'live' ? 'paused' : 'live',
                          })
                        }
                        disabled={updateStatus.isPending}
                        className="min-h-11 rounded-md border border-line px-3 text-xs uppercase tracking-wide text-hanko-text disabled:opacity-60"
                      >
                        {row.club.status === 'live' ? 'Suspend' : suspended ? 'Reactivate' : 'Go live'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
