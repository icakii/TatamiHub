import { useBilling, useMarkPaid } from '../hooks/useBilling'
import { useUpdateClubStatus } from '../hooks/useClubs'

function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`
}

export function Billing() {
  const { data: rows, isLoading } = useBilling()
  const markPaid = useMarkPaid()
  const updateStatus = useUpdateClubStatus()
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="px-6 py-6">
      <h1 className="font-display text-xl uppercase tracking-wide text-text">Billing</h1>
      <p className="mt-1 text-sm text-muted">
        What each club owes us. Tracking only — no automatic charging yet, mark a club paid once
        you've received the transfer.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
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
                    <span className={suspended ? 'text-hanko-text' : 'text-sage'}>
                      {suspended ? 'Suspended' : 'Live'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => markPaid.mutate(row.club_id)}
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
                            status: suspended ? 'live' : 'paused',
                          })
                        }
                        disabled={updateStatus.isPending}
                        className="min-h-11 rounded-md border border-line px-3 text-xs uppercase tracking-wide text-hanko-text disabled:opacity-60"
                      >
                        {suspended ? 'Reactivate' : 'Suspend'}
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
