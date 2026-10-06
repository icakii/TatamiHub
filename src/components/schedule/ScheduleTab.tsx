import { useState } from 'react'
import { ClassModal } from './ClassModal'
import { useClasses, useDeleteClass, type ClassRow } from '../../hooks/useClasses'
import { useGroups } from '../../hooks/useGroups'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

export function ScheduleTab({ clubId }: { clubId: string }) {
  const { data: classes, isLoading } = useClasses(clubId)
  const { data: groups } = useGroups(clubId)
  const deleteClass = useDeleteClass(clubId)

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ClassRow | null>(null)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const todayISO = toISODate(new Date())
  const [selectedDate, setSelectedDate] = useState(todayISO)

  function groupName(groupId: string | null) {
    if (!groupId) return 'Everyone'
    return groups?.find((g) => g.id === groupId)?.name ?? '—'
  }

  function handleDelete(cls: ClassRow) {
    if (confirm(`Delete "${cls.title}"?`)) {
      deleteClass.mutate(cls.id)
    }
  }

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = addDays(monthStart, -mondayIndex(monthStart))
  const gridEnd = addDays(monthEnd, 6 - mondayIndex(monthEnd))
  const days: Date[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d)

  const selectedWeekday = mondayIndex(new Date(selectedDate + 'T00:00:00'))
  const selectedClasses = (classes ?? []).filter((c) => c.weekday === selectedWeekday)

  return (
    <div className="mt-6">
      {/* Capped width — a 7-column grid stretched across a wide admin page
          turns into oversized cells otherwise. */}
      <div className="max-w-xl rounded-lg border border-line bg-panel p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewMonth(addDays(startOfMonth(viewMonth), -1))}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-text"
            aria-label="Previous month"
          >
            ←
          </button>
          <p className="font-display text-sm uppercase tracking-wide text-text">
            {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <button
            type="button"
            onClick={() => setViewMonth(addDays(endOfMonth(viewMonth), 1))}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-text"
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted">
          {WEEKDAYS_SHORT.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const iso = toISODate(day)
            const weekday = mondayIndex(day)
            const inMonth = day.getMonth() === viewMonth.getMonth()
            const dayClasses = (classes ?? []).filter((c) => c.weekday === weekday)
            const isToday = iso === todayISO
            const isSelected = iso === selectedDate

            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDate(iso)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-md text-xs transition-colors ${
                  isSelected
                    ? 'bg-hanko text-text'
                    : isToday
                      ? 'border border-hanko-text text-text'
                      : 'text-text'
                } ${!inMonth ? 'opacity-30' : ''}`}
              >
                {day.getDate()}
                {dayClasses.length > 0 && (
                  <span
                    className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                      isSelected ? 'bg-text' : dayClasses.some((c) => c.group_id) ? 'bg-hanko' : 'bg-straw'
                    }`}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs uppercase tracking-wide text-muted">{WEEKDAYS[selectedWeekday]}</p>
          {selectedClasses.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No classes.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {selectedClasses.map((cls) => (
                <div key={cls.id} className="flex justify-between text-sm">
                  <span className="text-text">{cls.title}</span>
                  <span className="text-muted">
                    {cls.start_time.slice(0, 5)} · {groupName(cls.group_id)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="min-h-11 rounded-md bg-hanko px-4 font-display text-sm uppercase tracking-wide text-text"
        >
          New class
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-panel text-left text-xs uppercase tracking-wide text-muted">
              <th className="p-3">Title</th>
              <th className="p-3">When</th>
              <th className="p-3">Group</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted">
                  ...
                </td>
              </tr>
            )}
            {classes?.map((cls) => (
              <tr key={cls.id} className="border-b border-line last:border-0">
                <td className="p-3 text-text">{cls.title}</td>
                <td className="p-3 text-muted">
                  {WEEKDAYS[cls.weekday]} · {cls.start_time.slice(0, 5)} · {cls.duration_min} min
                </td>
                <td className="p-3 text-muted">{groupName(cls.group_id)}</td>
                <td className="p-3">
                  <div className="flex gap-2 text-xs uppercase tracking-wide">
                    <button
                      type="button"
                      onClick={() => setEditTarget(cls)}
                      className="min-h-11 rounded-md border border-line px-3 text-muted"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cls)}
                      className="min-h-11 rounded-md border border-line px-3 text-hanko-text"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <ClassModal clubId={clubId} cls={null} onClose={() => setShowModal(false)} />}
      {editTarget && (
        <ClassModal clubId={clubId} cls={editTarget} onClose={() => setEditTarget(null)} />
      )}
    </div>
  )
}
