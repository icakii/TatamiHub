import { useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import { useCreateMemberAccount, type Member } from '../../hooks/useMembers'

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function CreateLoginModal({
  clubId,
  member,
  onClose,
}: {
  clubId: string
  member: Member
  onClose: () => void
}) {
  const createAccount = useCreateMemberAccount(clubId)

  const [email, setEmail] = useState(member.email ?? '')
  const [password, setPassword] = useState(randomPassword)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createAccount.mutateAsync({ club_id: clubId, member_id: member.id, email, password })
      setCreated({ email, password })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  if (created) {
    return (
      <Modal title="Account created" closeLabel="Done" onClose={onClose}>
        <p>Save these details and send them to the student — the password won't be shown again.</p>
        <div className="mt-4 space-y-2 rounded-md border border-line bg-ink p-3 font-mono text-xs text-text">
          <p>{created.email}</p>
          <p>{created.password}</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`Login for ${member.full_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text outline-none focus:border-hanko-text"
          />
        </label>

        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Password</span>
          <div className="mt-1 flex gap-2">
            <input
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-11 w-full rounded-md border border-line bg-ink px-3 font-mono text-text outline-none focus:border-hanko-text"
            />
            <button
              type="button"
              onClick={() => setPassword(randomPassword())}
              className="min-h-11 shrink-0 rounded-md border border-line px-3 text-xs uppercase tracking-wide text-muted"
            >
              New
            </button>
          </div>
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
            disabled={createAccount.isPending}
            className="min-h-11 flex-1 rounded-md bg-hanko font-display text-sm uppercase tracking-wide text-text disabled:opacity-60"
          >
            {createAccount.isPending ? 'Saving...' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
