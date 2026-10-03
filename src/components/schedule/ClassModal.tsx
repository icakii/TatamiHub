import { useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import { useCreateClass, useUpdateClass, type ClassRow } from '../../hooks/useClasses'
import { useGroups } from '../../hooks/useGroups'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function ClassModal({
  clubId,
  cls,
  onClose,
}: {
  clubId: string
  cls: ClassRow | null
  onClose: () => void
}) {
  const { data: groups } = useGroups(clubId)
  const createClass = useCreateClass(clubId)
  const updateClass = useUpdateClass(clubId)

  const [title, setTitle] = useState(cls?.title ?? '')
  const [weekday, setWeekday] = useState(cls?.weekday ?? 0)
  const [startTime, setStartTime] = useState(cls?.start_time?.slice(0, 5) ?? '18:00')
  const [durationMin, setDurationMin] = useState(cls?.duration_min ?? 60)
  const [groupId, setGroupId] = useState(cls?.group_id ?? '')
  const [error, setError] = useState<string | null>(null)

  const pending = createClass.isPending || updateClass.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const input = {
      title,
      weekday,
      start_time: startTime,
      duration_min: durationMin,
      group_id: groupId || null,
    }
    try {
      if (cls) {
        await updateClass.mutateAsync({ classId: cls.id, updates: input })
      } else {
        await createClass.mutateAsync(input)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal title={cls ? 'Edit class' : 'New class'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text outline-none focus:border-hanko-text"
          />
        </label>

        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Weekday</span>
          <select
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text"
          >
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="block text-xs uppercase tracking-wide text-muted">Start time</span>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text"
            />
          </label>
          <label className="block flex-1">
            <span className="block text-xs uppercase tracking-wide text-muted">
              Duration (min)
            </span>
            <input
              type="number"
              required
              min={1}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text"
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">
            Group (optional — empty means visible to every student)
          </span>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text"
          >
            <option value="">Everyone</option>
            {groups?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-hanko-text">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-md border border-line font-display text-sm uppercase tracking-wide text-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 flex-1 rounded-md bg-hanko font-display text-sm uppercase tracking-wide text-text disabled:opacity-60"
          >
            {pending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
