import { useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import { useBelts, useCreateMemberAccount, useUpdateMember } from '../../hooks/useMembers'
import { useGroups } from '../../hooks/useGroups'

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function AddMemberModal({ clubId, onClose }: { clubId: string; onClose: () => void }) {
  const { data: belts } = useBelts(clubId)
  const { data: groups } = useGroups(clubId)
  const createAccount = useCreateMemberAccount(clubId)
  const updateMember = useUpdateMember(clubId)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(randomPassword)
  const [beltId, setBeltId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [phone, setPhone] = useState('')
  const [showGuardian, setShowGuardian] = useState(false)
  const [guardianFirstName, setGuardianFirstName] = useState('')
  const [guardianLastName, setGuardianLastName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const member = await createAccount.mutateAsync({
        club_id: clubId,
        full_name: fullName,
        email,
        password,
        belt_id: beltId || undefined,
        group_id: groupId || undefined,
        birth_year: birthYear ? Number(birthYear) : undefined,
        phone: phone || undefined,
        guardian_consent: showGuardian && !!guardianFirstName,
      })

      if (showGuardian && guardianFirstName) {
        await updateMember.mutateAsync({
          memberId: member.id,
          updates: {
            guardian_first_name: guardianFirstName,
            guardian_last_name: guardianLastName || null,
            guardian_phone: guardianPhone || null,
            guardian_email: guardianEmail || null,
          },
        })
      }

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
    <Modal title="New member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <Field label="Full name">
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Password">
          <div className="flex gap-2">
            <input
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} font-mono`}
            />
            <button
              type="button"
              onClick={() => setPassword(randomPassword())}
              className="min-h-11 shrink-0 rounded-md border border-line px-3 text-xs uppercase tracking-wide text-muted"
            >
              New
            </button>
          </div>
        </Field>

        <Field label="Belt">
          <select value={beltId} onChange={(e) => setBeltId(e.target.value)} className={inputClass}>
            <option value="">-</option>
            {belts?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name_bg}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Group">
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputClass}>
            <option value="">-</option>
            {groups?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Birth year">
          <input
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>

        {!showGuardian ? (
          <button
            type="button"
            onClick={() => setShowGuardian(true)}
            className="min-h-11 rounded-md border border-line px-3 text-xs uppercase tracking-wide text-muted"
          >
            + Add parent / legal guardian
          </button>
        ) : (
          <div className="space-y-3 rounded-md border border-line p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted">Parent / legal guardian</p>
              <button
                type="button"
                onClick={() => setShowGuardian(false)}
                className="text-xs text-hanko-text"
              >
                Remove
              </button>
            </div>
            <Field label="First name">
              <input
                required
                value={guardianFirstName}
                onChange={(e) => setGuardianFirstName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Last name (optional)">
              <input
                value={guardianLastName}
                onChange={(e) => setGuardianLastName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Phone (optional)">
              <input
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Email (optional)">
              <input
                type="email"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        )}

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

const inputClass =
  'mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text outline-none focus:border-hanko-text'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}
