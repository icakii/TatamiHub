import { useState } from 'react'
import { ClassModal } from './ClassModal'
import { useClasses, useDeleteClass, type ClassRow } from '../../hooks/useClasses'
import { useGroups } from '../../hooks/useGroups'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function ScheduleTab({ clubId }: { clubId: string }) {
  const { data: classes, isLoading } = useClasses(clubId)
  const { data: groups } = useGroups(clubId)
  const deleteClass = useDeleteClass(clubId)

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ClassRow | null>(null)

  function groupName(groupId: string | null) {
    if (!groupId) return 'Everyone'
    return groups?.find((g) => g.id === groupId)?.name ?? '—'
  }

  function handleDelete(cls: ClassRow) {
    if (confirm(`Delete "${cls.title}"?`)) {
      deleteClass.mutate(cls.id)
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-end">
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
