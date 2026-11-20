import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { eur } from '../hooks/useLedger'
import { safeHttpUrl } from '../lib/date'
import { supabase } from '../lib/supabaseClient'

type Period = 'monthly' | 'yearly' | 'one_time'
type Status = 'planned' | 'active' | 'stopped'

interface Cost {
  id: string
  name: string
  amount_cents: number | null
  period: Period
  status: Status
  notes: string | null
  url: string | null
  author_name: string | null
}

const PERIOD_LABEL: Record<Period, string> = { monthly: '/ month', yearly: '/ year', one_time: 'once' }
const STATUS_STYLE: Record<Status, string> = {
  active: 'bg-sage/15 text-sage',
  planned: 'bg-amber/15 text-amber',
  stopped: 'bg-raised text-muted line-through',
}
const input = 'min-h-10 rounded-md border border-line bg-ink px-3 text-sm text-text outline-none focus:border-straw'

const perMonth = (c: Cost) => (c.amount_cents == null ? 0 : c.period === 'monthly' ? c.amount_cents : c.period === 'yearly' ? Math.round(c.amount_cents / 12) : 0)

// What running Tatami costs: services we pay for now (active) and the ones
// coming (planned). Real payments still go in the ledger as expenses.
export function RecurringCosts() {
  const queryClient = useQueryClient()
  const { data: costs } = useQuery({
    queryKey: ['recurring-costs'],
    queryFn: async (): Promise<Cost[]> => {
      const { data, error } = await supabase.from('recurring_costs').select('id, name, amount_cents, period, status, notes, url, author_name').order('status').order('name')
      if (error) throw error
      return data as Cost[]
    },
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['recurring-costs'] })
  const update = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<Cost> }) => {
      const { error } = await supabase.from('recurring_costs').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const add = useMutation({
    mutationFn: async (fields: Partial<Cost>) => {
      const { error } = await supabase.from('recurring_costs').insert(fields)
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_costs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const [form, setForm] = useState({ name: '', amount: '', period: 'monthly' as Period })

  const list = costs ?? []
  const activeMonthly = list.filter((c) => c.status === 'active').reduce((s, c) => s + perMonth(c), 0)
  const plannedMonthly = list.filter((c) => c.status === 'planned').reduce((s, c) => s + perMonth(c), 0)
  const plannedOnce = list.filter((c) => c.status === 'planned' && c.period === 'one_time').reduce((s, c) => s + (c.amount_cents ?? 0), 0)

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const cents = form.amount.trim() ? Math.round(Number(form.amount.replace(',', '.')) * 100) : null
    add.mutate({ name: form.name.trim(), amount_cents: cents, period: form.period, status: 'planned' })
    setForm({ name: '', amount: '', period: 'monthly' })
  }

  return (
    <section className="mt-8 rounded-lg border border-line bg-panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Running costs</p>
          <p className="mt-1 text-sm text-muted">What Tatami costs to run. Yearly costs count as 1/12 per month.</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Now</p>
            <p className="font-display text-2xl text-sage">{eur(activeMonthly)}<span className="text-sm text-muted"> / mo</span></p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">+ planned</p>
            <p className="font-display text-2xl text-amber">{eur(plannedMonthly)}<span className="text-sm text-muted"> / mo</span></p>
            {plannedOnce > 0 && <p className="text-[11px] text-muted">+ {eur(plannedOnce)} once</p>}
          </div>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-line">
        {list.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-text">
                {safeHttpUrl(c.url) ? (
                  <a href={safeHttpUrl(c.url)!} target="_blank" rel="noopener noreferrer" className="hover:text-straw">
                    {c.name} ↗
                  </a>
                ) : (
                  c.name
                )}
              </p>
              {c.notes && <p className="mt-0.5 text-xs leading-relaxed text-muted">{c.notes}</p>}
            </div>
            <p className="w-36 text-right font-display text-lg text-text">
              {c.amount_cents == null ? <span className="text-sm text-muted">?</span> : eur(c.amount_cents)}
              <span className="ml-1 text-xs text-muted">{PERIOD_LABEL[c.period]}</span>
            </p>
            <select
              value={c.status}
              onChange={(e) => update.mutate({ id: c.id, fields: { status: e.target.value as Status } })}
              className={`rounded-full px-3 py-1 text-xs ${STATUS_STYLE[c.status]} border-0 outline-none`}
              aria-label="Status"
            >
              <option value="planned">planned</option>
              <option value="active">active</option>
              <option value="stopped">stopped</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const v = window.prompt(`${c.name}: amount in €`, c.amount_cents == null ? '' : String(c.amount_cents / 100))
                if (v !== null) update.mutate({ id: c.id, fields: { amount_cents: v.trim() ? Math.round(Number(v.replace(',', '.')) * 100) : null } })
              }}
              className="rounded px-2 py-1 text-xs text-muted hover:text-text"
            >
              edit €
            </button>
            <button type="button" onClick={() => window.confirm(`Remove ${c.name}?`) && remove.mutate(c.id)} className="rounded px-2 py-1 text-xs text-muted hover:text-hanko-text" aria-label="Remove">
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={onAdd} className="mt-3 flex flex-wrap gap-2">
        <input required maxLength={80} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Service" className={`${input} flex-1`} />
        <input inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="€" className={`${input} w-24`} />
        <select value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as Period }))} className={input}>
          <option value="monthly">monthly</option>
          <option value="yearly">yearly</option>
          <option value="one_time">one time</option>
        </select>
        <button type="submit" className="min-h-10 rounded-md border border-line px-4 text-sm text-muted hover:text-text">
          + Add
        </button>
      </form>
    </section>
  )
}
