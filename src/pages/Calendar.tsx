import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageTitle } from '../components/ui'
import { useClubs } from '../hooks/useClubs'
import { localISODate } from '../lib/date'
import { supabase } from '../lib/supabaseClient'

type Kind = 'event' | 'deadline' | 'meeting' | 'competition'

interface TeamEvent {
  id: string
  title: string
  starts_on: string
  start_time: string | null
  ends_on: string | null
  location: string | null
  notes: string | null
  club_id: string | null
  kind: Kind
  author_name: string | null
  club: { name: string } | null
}

// One row per day on the grid, whatever its source.
interface Item {
  key: string
  date: string
  title: string
  time?: string | null
  tone: string
  source: 'event' | 'competition' | 'task'
  event?: TeamEvent
  sub?: string
}

const KIND_TONE: Record<Kind, string> = {
  event: 'bg-straw/20 text-straw',
  meeting: 'bg-sage/20 text-sage',
  deadline: 'bg-hanko/20 text-hanko-text',
  competition: 'bg-amber/20 text-amber',
}
const KIND_LABEL: Record<Kind, string> = { event: 'Event', meeting: 'Meeting', deadline: 'Deadline', competition: 'Competition' }
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const input = 'mt-1 min-h-10 w-full rounded-md border border-line bg-ink px-3 text-sm text-text outline-none focus:border-straw'
const label = 'block text-[11px] uppercase tracking-wider text-muted'

function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => localISODate(new Date(year, month, 1 - offset + i)))
}

// The founders' calendar: our events, every club's competitions and board
// tasks with a due date, on one month grid. Updates live.
export function Calendar() {
  const queryClient = useQueryClient()
  const today = localISODate()
  const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))
  const [selected, setSelected] = useState<string>(today)
  const [editing, setEditing] = useState<TeamEvent | { starts_on: string } | null>(null)
  const days = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor])
  const from = days[0]
  const to = days[days.length - 1]

  const { data: items } = useQuery({
    queryKey: ['calendar', from, to],
    queryFn: async (): Promise<Item[]> => {
      const [events, comps, tasks] = await Promise.all([
        supabase.from('team_events').select('*, club:clubs(name)').gte('starts_on', from).lte('starts_on', to),
        supabase.from('competitions').select('id, name, event_date, start_time, location, club:clubs(name)').gte('event_date', from).lte('event_date', to),
        supabase.from('team_notes').select('id, title, due_on, board_column').not('due_on', 'is', null).gte('due_on', from).lte('due_on', to),
      ])
      if (events.error) throw events.error
      const out: Item[] = []
      for (const e of (events.data ?? []) as TeamEvent[]) {
        out.push({ key: `e-${e.id}`, date: e.starts_on, title: e.title, time: e.start_time, tone: KIND_TONE[e.kind], source: 'event', event: e, sub: e.club?.name })
      }
      for (const c of (comps.data ?? []) as unknown as { id: string; name: string; event_date: string; start_time: string | null; location: string | null; club: { name: string } | null }[]) {
        out.push({ key: `c-${c.id}`, date: c.event_date, title: `🏆 ${c.name}`, time: c.start_time, tone: KIND_TONE.competition, source: 'competition', sub: [c.club?.name, c.location].filter(Boolean).join(' · ') })
      }
      for (const t of (tasks.data ?? []) as { id: string; title: string; due_on: string; board_column: string }[]) {
        if (t.board_column === 'done') continue
        out.push({ key: `t-${t.id}`, date: t.due_on, title: `☐ ${t.title}`, tone: 'bg-raised text-muted', source: 'task', sub: 'Board task' })
      }
      return out.sort((a, b) => (a.time ?? '99') < (b.time ?? '99') ? -1 : 1)
    },
  })

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['calendar'] })
    const channel = supabase.channel('team-calendar').on('postgres_changes', { event: '*', schema: 'public', table: 'team_events' }, refresh).subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const it of items ?? []) m.set(it.date, [...(m.get(it.date) ?? []), it])
    return m
  }, [items])
  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const thisMonth = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`
  const dayItems = byDay.get(selected) ?? []

  const shift = (d: number) => setCursor((c) => {
    const n = new Date(c.y, c.m + d, 1)
    return { y: n.getFullYear(), m: n.getMonth() }
  })

  return (
    <div className="px-6 py-8">
      <PageTitle title="Calendar" subtitle="Our events, every club's competitions and board tasks with a due date.">
        <button type="button" onClick={() => setEditing({ starts_on: selected })} className="min-h-10 rounded-md bg-hanko px-4 font-display text-xs uppercase tracking-wide text-text hover:bg-hanko/90">
          + Event
        </button>
      </PageTitle>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-line bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="rounded-md px-3 py-1.5 text-lg text-muted hover:bg-raised hover:text-text" aria-label="Previous month">‹</button>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-lg uppercase tracking-wide text-text">{monthName}</h2>
              <button
                type="button"
                onClick={() => {
                  setCursor({ y: new Date().getFullYear(), m: new Date().getMonth() })
                  setSelected(today)
                }}
                className="rounded-full border border-line px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-muted hover:text-text"
              >
                Today
              </button>
            </div>
            <button type="button" onClick={() => shift(1)} className="rounded-md px-3 py-1.5 text-lg text-muted hover:bg-raised hover:text-text" aria-label="Next month">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wider text-muted">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const list = byDay.get(d) ?? []
              const inMonth = d.startsWith(thisMonth)
              const isSel = d === selected
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelected(d)}
                  onDoubleClick={() => setEditing({ starts_on: d })}
                  className={`flex min-h-24 flex-col rounded-md border p-1.5 text-left transition-colors ${
                    isSel ? 'border-straw/60 bg-raised' : 'border-transparent hover:bg-raised/60'
                  } ${inMonth ? '' : 'opacity-40'}`}
                >
                  <span className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${d === today ? 'bg-hanko text-text' : 'text-muted'}`}>
                    {Number(d.slice(8))}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    {list.slice(0, 3).map((it) => (
                      <span key={it.key} className={`truncate rounded px-1.5 py-0.5 text-[10px] ${it.tone}`}>
                        {it.time ? `${it.time.slice(0, 5)} ` : ''}
                        {it.title}
                      </span>
                    ))}
                    {list.length > 3 && <span className="px-1 text-[10px] text-muted">+{list.length - 3} more</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="rounded-lg border border-line bg-panel p-4">
          <p className="font-display text-sm uppercase tracking-wide text-text">
            {new Date(`${selected}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <ul className="mt-3 space-y-2">
            {dayItems.length === 0 && <li className="text-sm text-muted">Nothing on this day.</li>}
            {dayItems.map((it) => (
              <li key={it.key}>
                <button
                  type="button"
                  disabled={it.source !== 'event'}
                  onClick={() => it.event && setEditing(it.event)}
                  className="w-full rounded-md border border-line bg-ink p-3 text-left transition-colors enabled:hover:border-straw/40"
                >
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${it.tone}`}>
                    {it.event ? KIND_LABEL[it.event.kind] : it.source === 'competition' ? 'Club competition' : 'Task'}
                  </span>
                  <p className="mt-1 text-sm text-text">
                    {it.time ? `${it.time.slice(0, 5)} · ` : ''}
                    {it.title}
                  </p>
                  {(it.sub || it.event?.location) && <p className="text-xs text-muted">{[it.sub, it.event?.location].filter(Boolean).join(' · ')}</p>}
                  {it.event?.notes && <p className="mt-1 whitespace-pre-line text-xs text-muted">{it.event.notes}</p>}
                  {it.event?.author_name && <p className="mt-1 text-[10px] text-muted">added by {it.event.author_name}</p>}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setEditing({ starts_on: selected })} className="mt-3 w-full rounded-md border border-dashed border-line py-2 text-xs uppercase tracking-wide text-muted hover:text-text">
            + Add on this day
          </button>
        </aside>
      </div>

      {editing && <EventModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EventModal({ initial, onClose }: { initial: TeamEvent | { starts_on: string }; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: clubs } = useClubs()
  const existing = 'id' in initial ? initial : null
  const [f, setF] = useState({
    title: existing?.title ?? '',
    starts_on: initial.starts_on,
    start_time: existing?.start_time?.slice(0, 5) ?? '',
    ends_on: existing?.ends_on ?? '',
    location: existing?.location ?? '',
    notes: existing?.notes ?? '',
    club_id: existing?.club_id ?? '',
    kind: (existing?.kind ?? 'event') as Kind,
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }))
  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar'] })
    onClose()
  }
  const save = useMutation({
    mutationFn: async () => {
      const row = {
        title: f.title.trim(),
        starts_on: f.starts_on,
        start_time: f.start_time || null,
        ends_on: f.ends_on || null,
        location: f.location.trim() || null,
        notes: f.notes.trim() || null,
        club_id: f.club_id || null,
        kind: f.kind,
      }
      const { error } = existing ? await supabase.from('team_events').update(row).eq('id', existing.id) : await supabase.from('team_events').insert(row)
      if (error) throw error
    },
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('team_events').delete().eq('id', existing!.id)
      if (error) throw error
    },
    onSuccess: done,
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/80 px-6 backdrop-blur-sm" onClick={onClose}>
      <form role="dialog" aria-modal="true" onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className="hub-pop w-full max-w-md space-y-3 rounded-xl border border-line bg-panel p-6 shadow-2xl">
        <h2 className="font-display text-lg uppercase tracking-wide text-text">{existing ? 'Edit event' : 'New event'}</h2>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <button key={k} type="button" onClick={() => setF((s) => ({ ...s, kind: k }))} className={`rounded-full px-3 py-1 text-xs ${f.kind === k ? KIND_TONE[k] : 'border border-line text-muted'}`}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <label className="block">
          <span className={label}>Title</span>
          <input autoFocus required maxLength={160} value={f.title} onChange={set('title')} className={input} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className={label}>Date</span>
            <input type="date" required value={f.starts_on} onChange={set('starts_on')} className={input} />
          </label>
          <label className="block">
            <span className={label}>Time</span>
            <input type="time" value={f.start_time} onChange={set('start_time')} className={input} />
          </label>
          <label className="block">
            <span className={label}>Until</span>
            <input type="date" min={f.starts_on} value={f.ends_on} onChange={set('ends_on')} className={input} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>Place</span>
            <input maxLength={160} value={f.location} onChange={set('location')} className={input} />
          </label>
          <label className="block">
            <span className={label}>Club</span>
            <select value={f.club_id} onChange={set('club_id')} className={input}>
              <option value="">-</option>
              {clubs?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className={label}>Notes</span>
          <textarea rows={3} maxLength={4000} value={f.notes} onChange={set('notes')} className={`${input} py-2`} />
        </label>
        {save.error && <p className="text-sm text-hanko-text">{(save.error as Error).message}</p>}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button type="button" onClick={onClose} className="min-h-11 rounded-md border border-line font-display text-sm uppercase tracking-wide text-muted">Cancel</button>
          <button type="submit" disabled={save.isPending} className="min-h-11 rounded-md bg-hanko font-display text-sm uppercase tracking-wide text-text disabled:opacity-60">
            {save.isPending ? '...' : 'Save'}
          </button>
        </div>
        {existing && (
          <button type="button" onClick={() => window.confirm('Delete this event?') && remove.mutate()} className="w-full text-center text-xs uppercase tracking-wide text-muted hover:text-hanko-text">
            Delete event
          </button>
        )}
      </form>
    </div>
  )
}
