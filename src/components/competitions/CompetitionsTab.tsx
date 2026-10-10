import { useState, type FormEvent } from 'react'
import {
  useAddEntry,
  useCompetitionEntries,
  useCompetitions,
  useCreateCompetition,
  useDeleteCompetition,
  useRemoveEntry,
  useUpdateEntry,
} from '../../hooks/useCompetitions'
import { useMembers } from '../../hooks/useMembers'

const MEDALS = ['gold', 'silver', 'bronze'] as const

export function CompetitionsTab({ clubId }: { clubId: string }) {
  const { data: competitions, isLoading } = useCompetitions(clubId)
  const createCompetition = useCreateCompetition(clubId)
  const deleteCompetition = useDeleteCompetition(clubId)
  const [openId, setOpenId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [eventDate, setEventDate] = useState('')

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    await createCompetition.mutateAsync({
      name,
      location: location || undefined,
      event_date: eventDate,
    })
    setName('')
    setLocation('')
    setEventDate('')
  }

  function handleDelete(id: string, compName: string) {
    if (confirm(`Delete "${compName}"? All entries/results for it will be deleted too.`)) {
      deleteCompetition.mutate(id)
      if (openId === id) setOpenId(null)
    }
  }

  return (
    <div className="mt-6">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-11 rounded-md border border-line bg-panel px-3 text-text outline-none focus:border-hanko-text"
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Location</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 min-h-11 rounded-md border border-line bg-panel px-3 text-text outline-none focus:border-hanko-text"
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Date</span>
          <input
            required
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="mt-1 min-h-11 rounded-md border border-line bg-panel px-3 text-text outline-none focus:border-hanko-text"
          />
        </label>
        <button
          type="submit"
          disabled={createCompetition.isPending}
          className="min-h-11 rounded-md bg-hanko px-4 font-display text-sm uppercase tracking-wide text-text disabled:opacity-60"
        >
          Add competition
        </button>
      </form>

      <div className="mt-4 space-y-2">
        {isLoading && <p className="text-muted">...</p>}
        {!isLoading && competitions?.length === 0 && (
          <p className="text-muted">No competitions yet.</p>
        )}
        {competitions?.map((comp) => (
          <div key={comp.id} className="rounded-lg border border-line bg-panel">
            <div className="flex items-center justify-between p-4">
              <button
                type="button"
                onClick={() => setOpenId(openId === comp.id ? null : comp.id)}
                className="flex-1 text-left"
              >
                <p className="text-text">{comp.name}</p>
                <p className="text-sm text-muted">
                  {comp.event_date}
                  {comp.location ? ` — ${comp.location}` : ''}
                </p>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(comp.id, comp.name)}
                className="ml-3 shrink-0 text-xs uppercase tracking-wide text-hanko-text"
              >
                Delete
              </button>
            </div>
            {openId === comp.id && <EntriesPanel clubId={clubId} competitionId={comp.id} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function EntriesPanel({ clubId, competitionId }: { clubId: string; competitionId: string }) {
  const { data: members } = useMembers(clubId)
  const { data: entries } = useCompetitionEntries(competitionId)
  const addEntry = useAddEntry(clubId, competitionId)
  const updateEntry = useUpdateEntry(competitionId)
  const removeEntry = useRemoveEntry(competitionId)

  const [memberId, setMemberId] = useState('')
  const [category, setCategory] = useState('')

  const entered = new Set((entries ?? []).map((e) => e.member_id))
  const available = (members ?? []).filter((m) => m.role === 'student' && !entered.has(m.id))

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!memberId) return
    await addEntry.mutateAsync({ member_id: memberId, category: category || undefined })
    setMemberId('')
    setCategory('')
  }

  return (
    <div className="border-t border-line p-4">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="min-h-11 rounded-md border border-line bg-raised px-3 text-sm text-text outline-none focus:border-hanko-text"
        >
          <option value="">Pick a student</option>
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="min-h-11 rounded-md border border-line bg-raised px-3 text-sm text-text outline-none focus:border-hanko-text"
        />
        <button
          type="submit"
          disabled={!memberId || addEntry.isPending}
          className="min-h-11 rounded-md border border-line px-3 text-xs uppercase tracking-wide text-muted disabled:opacity-60"
        >
          Add
        </button>
      </form>

      <div className="mt-4 space-y-2">
        {(entries ?? []).map((entry) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-line p-2 text-sm"
          >
            <span className="min-w-[120px] text-text">{entry.member.full_name}</span>
            <span className="text-muted">{entry.category}</span>
            <input
              defaultValue={entry.placement ?? ''}
              onBlur={(e) =>
                updateEntry.mutate({ entryId: entry.id, updates: { placement: e.target.value } })
              }
              placeholder="Placement"
              className="min-h-9 w-28 rounded-md border border-line bg-raised px-2 text-text outline-none focus:border-hanko-text"
            />
            <select
              value={entry.medal ?? ''}
              onChange={(e) =>
                updateEntry.mutate({
                  entryId: entry.id,
                  updates: { medal: (e.target.value || null) as never },
                })
              }
              className="min-h-9 rounded-md border border-line bg-raised px-2 text-text outline-none focus:border-hanko-text"
            >
              <option value="">No medal</option>
              {MEDALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeEntry.mutate(entry.id)}
              className="ml-auto text-xs text-hanko-text"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
