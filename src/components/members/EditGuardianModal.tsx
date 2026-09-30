import { useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import { useUpdateMember, type Member } from '../../hooks/useMembers'

export function EditGuardianModal({
  clubId,
  member,
  onClose,
}: {
  clubId: string
  member: Member
  onClose: () => void
}) {
  const updateMember = useUpdateMember(clubId)
  const [firstName, setFirstName] = useState(member.guardian_first_name ?? '')
  const [lastName, setLastName] = useState(member.guardian_last_name ?? '')
  const [phone, setPhone] = useState(member.guardian_phone ?? '')
  const [email, setEmail] = useState(member.guardian_email ?? '')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await updateMember.mutateAsync({
      memberId: member.id,
      updates: {
        guardian_first_name: firstName || null,
        guardian_last_name: lastName || null,
        guardian_phone: phone || null,
        guardian_email: email || null,
      },
    })
    onClose()
  }

  return (
    <Modal title={`Guardian for ${member.full_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">First name</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text outline-none focus:border-hanko-text"
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">
            Last name (optional)
          </span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text outline-none focus:border-hanko-text"
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">
            Phone (optional)
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text outline-none focus:border-hanko-text"
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">
            Email (optional)
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text outline-none focus:border-hanko-text"
          />
        </label>

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
            disabled={updateMember.isPending}
            className="min-h-11 flex-1 rounded-md bg-hanko font-display text-sm uppercase tracking-wide text-text disabled:opacity-60"
          >
            {updateMember.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
