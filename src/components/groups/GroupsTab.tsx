import { useState } from 'react'
import { GroupModal } from './GroupModal'
import { useDeleteGroup, useGroups, type Group } from '../../hooks/useGroups'

export function GroupsTab({ clubId }: { clubId: string }) {
  const { data: groups, isLoading } = useGroups(clubId)
  const deleteGroup = useDeleteGroup(clubId)

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Group | null>(null)

  function handleDelete(group: Group) {
    if (
      confirm(
        `Delete "${group.name}"? Members and classes in this group will become ungrouped, not deleted.`,
      )
    ) {
      deleteGroup.mutate(group.id)
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Groups split students by age, skill level, or anything else that's useful. A class with
          no group stays visible to every student.
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="min-h-11 shrink-0 rounded-md bg-hanko px-4 font-display text-sm uppercase tracking-wide text-text"
        >
          New group
        </button>
      </div>

      <div className="mt-4 divide-y divide-line rounded-lg border border-line bg-panel">
        {isLoading && <p className="p-6 text-center text-muted">...</p>}
        {!isLoading && groups?.length === 0 && (
          <p className="p-6 text-center text-muted">No groups yet.</p>
        )}
        {groups?.map((g) => (
          <div key={g.id} className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="text-text">{g.name}</p>
              {g.room && <p className="mt-1 text-xs uppercase tracking-wide text-straw">{g.room}</p>}
              {g.description && <p className="mt-1 text-sm text-muted">{g.description}</p>}
            </div>
            <div className="flex shrink-0 gap-2 text-xs uppercase tracking-wide">
              <button
                type="button"
                onClick={() => setEditTarget(g)}
                className="min-h-11 rounded-md border border-line px-3 text-muted"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(g)}
                className="min-h-11 rounded-md border border-line px-3 text-hanko-text"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && <GroupModal clubId={clubId} group={null} onClose={() => setShowModal(false)} />}
      {editTarget && (
        <GroupModal clubId={clubId} group={editTarget} onClose={() => setEditTarget(null)} />
      )}
    </div>
  )
}
