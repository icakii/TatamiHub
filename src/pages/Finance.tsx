import { useMemo, useState, type FormEvent } from 'react'
import { PageTitle, StatTile } from '../components/ui'
import { useClubs } from '../hooks/useClubs'
import {
  CATEGORIES,
  METHODS,
  eur,
  openPrivateFile,
  useAddEntry,
  useDeleteEntry,
  useLedger,
  type LedgerEntry,
  type LedgerKind,
  type PayMethod,
} from '../hooks/useLedger'
import { localISODate } from '../lib/date'

const input = 'mt-1 min-h-10 w-full rounded-md border border-line bg-ink px-3 text-sm text-text outline-none focus:border-straw'
const label = 'block text-[11px] uppercase tracking-wider text-muted'
const MONTHS = 12

const monthKey = (iso: string) => iso.slice(0, 7)
const monthName = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })

function lastMonths(n: number): string[] {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
    return localISODate(d).slice(0, 7)
  })
}

function toCsv(rows: LedgerEntry[]): string {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['date', 'type', 'amount_eur', 'category', 'club', 'method', 'description', 'added_by']
  const body = rows.map((r) =>
    [r.occurred_on, r.kind, (r.kind === 'expense' ? -r.amount_cents : r.amount_cents) / 100, r.category, r.club?.name ?? '', r.method, r.description ?? '', r.author_name ?? '']
      .map(esc)
      .join(','),
  )
  return '﻿' + [head.join(','), ...body].join('\n')
}

// Money in and out of Tatami. "Mark paid" in Billing adds the income rows by
// itself; expenses and other income are added here, with a receipt photo.
export function Finance() {
  const { data: entries, isLoading } = useLedger()
  const del = useDeleteEntry()
  const [adding, setAdding] = useState<LedgerKind | null>(null)
  const [filter, setFilter] = useState<'all' | LedgerKind>('all')
  const [month, setMonth] = useState<string>('')

  const months = useMemo(() => lastMonths(MONTHS), [])
  const byMonth = useMemo(() => {
    const m = new Map<string, { income: number; expense: number }>()
    for (const e of entries ?? []) {
      const k = monthKey(e.occurred_on)
      const v = m.get(k) ?? { income: 0, expense: 0 }
      v[e.kind] += e.amount_cents
      m.set(k, v)
    }
    return m
  }, [entries])

  const thisMonth = byMonth.get(months[months.length - 1]) ?? { income: 0, expense: 0 }
  const year = String(new Date().getFullYear())
  const ytd = (entries ?? [])
    .filter((e) => e.occurred_on.startsWith(year))
    .reduce((s, e) => ({ ...s, [e.kind]: s[e.kind] + e.amount_cents }), { income: 0, expense: 0 })
  const peak = Math.max(1, ...months.map((k) => Math.max(byMonth.get(k)?.income ?? 0, byMonth.get(k)?.expense ?? 0)))

  const shown = (entries ?? []).filter((e) => (filter === 'all' || e.kind === filter) && (!month || monthKey(e.occurred_on) === month))

  function exportCsv() {
    const blob = new Blob([toCsv(shown)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tatami-finance-${month || 'all'}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="px-6 py-8">
      <PageTitle title="Finance" subtitle="Income and expenses. Payments marked in Billing land here automatically.">
        <div className="flex gap-2">
          <button type="button" onClick={() => setAdding('income')} className="min-h-10 rounded-md border border-sage/50 px-4 font-display text-xs uppercase tracking-wide text-sage hover:bg-sage/10">
            + Income
          </button>
          <button type="button" onClick={() => setAdding('expense')} className="min-h-10 rounded-md bg-hanko px-4 font-display text-xs uppercase tracking-wide text-text hover:bg-hanko/90">
            + Expense
          </button>
        </div>
      </PageTitle>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Income this month" value={eur(thisMonth.income)} accent="bg-sage" />
        <StatTile label="Expenses this month" value={eur(thisMonth.expense)} accent="bg-hanko" />
        <StatTile
          label="Profit this month"
          value={<span className={thisMonth.income - thisMonth.expense < 0 ? 'text-hanko-text' : ''}>{eur(thisMonth.income - thisMonth.expense)}</span>}
          accent="bg-straw"
        />
        <StatTile label={`Profit ${year}`} value={eur(ytd.income - ytd.expense)} accent="bg-amber" hint={`${eur(ytd.income)} in · ${eur(ytd.expense)} out`} />
      </div>

      {/* Last 12 months: income (green) and expenses (red) side by side. Click a month to filter. */}
      <div className="mt-6 rounded-lg border border-line bg-panel p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted">Last 12 months</p>
          <div className="flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sage" /> income</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-hanko" /> expenses</span>
          </div>
        </div>
        <div className="mt-4 flex h-40 items-end gap-2">
          {months.map((k) => {
            const v = byMonth.get(k) ?? { income: 0, expense: 0 }
            const active = month === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => setMonth(active ? '' : k)}
                title={`${monthName(k)}: +${eur(v.income)} / -${eur(v.expense)}`}
                className={`group flex h-full flex-1 flex-col justify-end rounded-md px-0.5 pb-1 transition-colors ${active ? 'bg-raised ring-1 ring-straw/50' : 'hover:bg-raised/60'}`}
              >
                <div className="flex h-full items-end justify-center gap-0.5">
                  <span className="w-1/2 max-w-4 rounded-t-sm bg-sage transition-all" style={{ height: `${(v.income / peak) * 100}%` }} />
                  <span className="w-1/2 max-w-4 rounded-t-sm bg-hanko transition-all" style={{ height: `${(v.expense / peak) * 100}%` }} />
                </div>
                <span className={`mt-1 block text-center text-[10px] ${active ? 'text-straw' : 'text-muted'}`}>{monthName(k)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-line p-1 text-xs">
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1.5 font-display uppercase tracking-wide ${filter === f ? 'bg-raised text-text' : 'text-muted hover:text-text'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {month && (
            <button type="button" onClick={() => setMonth('')} className="rounded-full border border-straw/40 px-3 py-1 text-straw">
              {monthName(month)} ✕
            </button>
          )}
          <button type="button" onClick={exportCsv} className="rounded-md border border-line px-3 py-1.5 uppercase tracking-wide hover:text-text">
            Export CSV
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-panel text-left text-xs uppercase tracking-wide text-muted">
              <th className="p-3">Date</th>
              <th className="p-3">Category</th>
              <th className="p-3">Description</th>
              <th className="p-3">Method</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Added by</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted">...</td>
              </tr>
            )}
            {!isLoading && shown.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted">Nothing here yet.</td>
              </tr>
            )}
            {shown.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0 hover:bg-panel/60">
                <td className="whitespace-nowrap p-3 text-muted">{e.occurred_on}</td>
                <td className="p-3 text-text">
                  {e.category}
                  {e.club && <span className="ml-2 rounded-full bg-raised px-2 py-0.5 text-[11px] text-straw">{e.club.name}</span>}
                </td>
                <td className="max-w-xs p-3 text-muted">
                  <span className="line-clamp-2">{e.description}</span>
                  {e.receipt_path && (
                    <button type="button" onClick={() => openPrivateFile(e.receipt_path!)} className="mt-1 block text-xs text-straw hover:underline">
                      receipt ↗
                    </button>
                  )}
                </td>
                <td className="p-3 capitalize text-muted">{e.method}</td>
                <td className={`whitespace-nowrap p-3 text-right font-display text-base ${e.kind === 'income' ? 'text-sage' : 'text-hanko-text'}`}>
                  {e.kind === 'income' ? '+' : '−'}
                  {eur(e.amount_cents)}
                </td>
                <td className="p-3 text-xs text-muted">{e.author_name}</td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => window.confirm('Delete this entry?') && del.mutate(e)}
                    className="rounded px-2 py-1 text-xs text-muted hover:text-hanko-text"
                    aria-label="Delete entry"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && <EntryModal kind={adding} onClose={() => setAdding(null)} />}
    </div>
  )
}

function EntryModal({ kind, onClose }: { kind: LedgerKind; onClose: () => void }) {
  const add = useAddEntry()
  const { data: clubs } = useClubs()
  const [f, setF] = useState({
    amount: '',
    occurred_on: localISODate(),
    category: CATEGORIES[kind][0],
    description: '',
    club_id: '',
    method: 'bank' as PayMethod,
  })
  const [receipt, setReceipt] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const cents = Math.round(Number(f.amount.replace(',', '.')) * 100)
    if (!(cents > 0)) return setError('Enter an amount above 0.')
    try {
      await add.mutateAsync({
        kind,
        amount_cents: cents,
        occurred_on: f.occurred_on,
        category: f.category,
        description: f.description.trim() || null,
        club_id: f.club_id || null,
        method: f.method,
        receipt,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/80 px-6 backdrop-blur-sm" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="hub-pop w-full max-w-md space-y-4 rounded-xl border border-line bg-panel p-6 shadow-2xl"
      >
        <h2 className={`font-display text-lg uppercase tracking-wide ${kind === 'income' ? 'text-sage' : 'text-hanko-text'}`}>
          New {kind}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={label}>Amount (€)</span>
            <input autoFocus required inputMode="decimal" value={f.amount} onChange={set('amount')} className={input} placeholder="0.00" />
          </label>
          <label>
            <span className={label}>Date</span>
            <input type="date" required value={f.occurred_on} onChange={set('occurred_on')} className={input} />
          </label>
          <label>
            <span className={label}>Category</span>
            <select value={f.category} onChange={set('category')} className={input}>
              {CATEGORIES[kind].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={label}>Method</span>
            <select value={f.method} onChange={set('method')} className={input}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2">
            <span className={label}>Club (optional)</span>
            <select value={f.club_id} onChange={set('club_id')} className={input}>
              <option value="">-</option>
              {clubs?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2">
            <span className={label}>Description</span>
            <input maxLength={500} value={f.description} onChange={set('description')} className={input} placeholder={kind === 'expense' ? 'e.g. Render hosting, November' : 'e.g. Spartak build fee'} />
          </label>
          <label className="col-span-2">
            <span className={label}>Receipt (photo or PDF, optional)</span>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-raised file:px-3 file:py-2 file:text-text" />
          </label>
        </div>
        {error && <p className="text-sm text-hanko-text">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="min-h-11 rounded-md border border-line font-display text-sm uppercase tracking-wide text-muted">
            Cancel
          </button>
          <button type="submit" disabled={add.isPending} className="min-h-11 rounded-md bg-hanko font-display text-sm uppercase tracking-wide text-text disabled:opacity-60">
            {add.isPending ? '...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
