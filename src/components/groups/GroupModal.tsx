import { useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import { useCreateGroup, useUpdateGroup, type Group } from '../../hooks/useGroups'

export function GroupModal({
  clubId,
  group,
  onClose,
}: {
  clubId: string
  group: Group | null
  onClose: () => void
}) {
  const createGroup = useCreateGroup(clubId)
  const updateGroup = useUpdateGroup(clubId)

  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [room, setRoom] = useState(group?.room ?? '')
  const [error, setError] = useState<string | null>(null)

  const pending = createGroup.isPending || updateGroup.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (group) {
        await updateGroup.mutateAsync({
          groupId: group.id,
          updates: { name, description: description || null, room: room.trim() || null },
        })
      } else {
        await createGroup.mutateAsync({ name, description: description || null, room: room.trim() || null })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal title={group ? 'Edit group' : 'New group'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text outline-none focus:border-hanko-text"
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Hall / room (optional)</span>
          <input
            value={room}
            maxLength={40}
            placeholder="e.g. Зала 2"
            onChange={(e) => setRoom(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text outline-none focus:border-hanko-text"
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">
            Description (optional) — age range, skill level, anything useful
          </span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-text outline-none focus:border-hanko-text"
          />
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
