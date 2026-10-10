import { useMemo, useState } from 'react'
import { StatTile, StatusBadge } from '../ui'
import { useClubPayments, useRecordDuesPayment, type DuesPayment } from '../../hooks/useDues'
import { useMembers } from '../../hooks/useMembers'

const METHODS: DuesPayment['method'][] = ['cash', 'bank', 'card', 'online']

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`
}

export function PaymentsTab({ clubId }: { clubId: string }) {
  const { data: members } = useMembers(clubId)
  const { data: payments, isLoading } = useClubPayments(clubId)
  const record = useRecordDuesPayment(clubId)
  const [methodFor, setMethodFor] = useState<Record<string, DuesPayment['method']>>({})
  const today = new Date().toISOString().slice(0, 10)

  const paidThrough = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of payments ?? []) {
      if (p.status !== 'paid') continue
      const cur = map.get(p.member_id)
      if (!cur || p.period_end > cur) map.set(p.member_id, p.period_end)
    }
    return map
  }, [payments])

  const students = (members ?? []).filter((m) => m.role === 'student' && m.status !== 'left')
  const current = students.filter((m) => (paidThrough.get(m.id) ?? '') >= today)
  const expectedCents = students.reduce((s, m) => s + (m.monthly_fee_cents ?? 0), 0)
  const memberName = new Map((members ?? []).map((m) => [m.id, m.full_name]))

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Paid up" value={`${current.length} / ${students.length}`} accent="bg-sage" hint="students current today" />
        <StatTile label="Behind" value={students.length - current.length} accent="bg-hanko" hint="lapsed or never paid" />
        <StatTile label="Expected monthly" value={eur(expectedCents)} accent="bg-straw" hint="sum of student fees" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-panel text-left text-xs uppercase tracking-wide text-muted">
              <th className="p-3">Student</th>
              <th className="p-3">Fee</th>
              <th className="p-3">Paid through</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {students.map((m) => {
              const through = paidThrough.get(m.id)
              const ok = (through ?? '') >= today
              const method = methodFor[m.id] ?? 'cash'
              return (
                <tr key={m.id} className="border-b border-line transition-colors last:border-0 hover:bg-panel/60">
                  <td className="p-3 text-text">{m.full_name}</td>
                  <td className="p-3 text-muted">{m.monthly_fee_cents != null ? eur(m.monthly_fee_cents) : '-'}</td>
                  <td className="p-3 font-mono text-xs text-muted">{through ?? '-'}</td>
                  <td className="p-3">
                    <StatusBadge status={ok ? 'paid' : through ? 'overdue' : 'due'} label={ok ? 'paid' : through ? 'overdue' : 'never paid'} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      <select
                        value={method}
                        onChange={(e) => setMethodFor((prev) => ({ ...prev, [m.id]: e.target.value as DuesPayment['method'] }))}
                        className="min-h-9 rounded-md border border-line bg-panel px-2 text-xs text-text"
                      >
                        {METHODS.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={m.monthly_fee_cents == null || record.isPending}
                        title={m.monthly_fee_cents == null ? 'Set a monthly fee on the Members tab first' : undefined}
                        onClick={() =>
                          record.mutate({
                            memberId: m.id,
                            amountCents: m.monthly_fee_cents ?? 0,
                            method,
                            paidThrough: through,
                          })
                        }
                        className="min-h-9 rounded-md bg-hanko px-3 text-xs uppercase tracking-wide text-text disabled:opacity-40"
                      >
                        Record month
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-straw">Recent payments</h3>
        <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-panel">
          {isLoading && <p className="p-4 text-muted">...</p>}
          {!isLoading && (payments ?? []).length === 0 && <p className="p-4 text-sm text-muted">No payments recorded yet.</p>}
          {(payments ?? []).slice(0, 12).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="text-text">{memberName.get(p.member_id) ?? '-'}</span>
              <span className="font-mono text-xs text-muted">
                {p.period_start} → {p.period_end}
              </span>
              <span className="text-xs uppercase tracking-wide text-muted">{p.method}</span>
              <span className="text-text">{eur(p.amount_cents)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
