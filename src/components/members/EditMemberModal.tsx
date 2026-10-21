import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import { useMembers, usePhotoUrl, useUpdateMember, useUploadMemberPhoto, type Member } from '../../hooks/useMembers'

const fieldClass =
  'mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text outline-none focus:border-hanko-text'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}

const toInt = (v: string) => (v.trim() ? Math.round(Number(v)) : null)

// Everything about a student that we enter for the club: photo, contacts,
// age, measurements (used for kit sizes in the store) and the parent.
// Belt, group, fee and status stay inline in the members table.
export function EditMemberModal({
  clubId,
  member: initial,
  onClose,
}: {
  clubId: string
  member: Member
  onClose: () => void
}) {
  const { data: members } = useMembers(clubId)
  const member = members?.find((m) => m.id === initial.id) ?? initial
  const updateMember = useUpdateMember(clubId)
  const uploadPhoto = useUploadMemberPhoto(clubId)
  const { data: photoUrl } = usePhotoUrl(member.photo_path)
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    full_name: initial.full_name,
    email: initial.email ?? '',
    phone: initial.phone ?? '',
    birth_year: initial.birth_year ? String(initial.birth_year) : '',
    height_cm: initial.height_cm ? String(initial.height_cm) : '',
    weight_kg: initial.weight_kg ? String(initial.weight_kg) : '',
    guardian_first_name: initial.guardian_first_name ?? '',
    guardian_last_name: initial.guardian_last_name ?? '',
    guardian_phone: initial.guardian_phone ?? '',
    guardian_email: initial.guardian_email ?? '',
  })
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const orNull = (v: string) => v.trim() || null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await updateMember.mutateAsync({
        memberId: member.id,
        updates: {
          full_name: form.full_name.trim(),
          email: orNull(form.email),
          phone: orNull(form.phone),
          birth_year: toInt(form.birth_year),
          height_cm: toInt(form.height_cm),
          weight_kg: toInt(form.weight_kg),
          guardian_first_name: orNull(form.guardian_first_name),
          guardian_last_name: orNull(form.guardian_last_name),
          guardian_phone: orNull(form.guardian_phone),
          guardian_email: orNull(form.guardian_email),
        },
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      await uploadPhoto.mutateAsync({ member, file })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed')
    }
  }

  return (
    <Modal title={member.full_name} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised font-display text-2xl text-straw ring-1 ring-line"
          >
            {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : member.full_name.charAt(0)}
          </button>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="min-h-11 rounded-md border border-line px-3 text-xs uppercase tracking-wide text-hanko-text"
            >
              {uploadPhoto.isPending ? 'Uploading...' : member.photo_path ? 'Change photo' : 'Add photo'}
            </button>
            <p className="mt-1 text-xs text-muted">Shrunk to 512px, location data removed.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </div>

        <Field label="Full name">
          <input required maxLength={120} value={form.full_name} onChange={set('full_name')} className={fieldClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input type="tel" maxLength={40} value={form.phone} onChange={set('phone')} className={fieldClass} />
          </Field>
          <Field label="Email">
            <input type="email" maxLength={200} value={form.email} onChange={set('email')} className={fieldClass} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Birth year">
            <input type="number" min={1930} max={new Date().getFullYear()} value={form.birth_year} onChange={set('birth_year')} className={fieldClass} />
          </Field>
          <Field label="Height cm">
            <input type="number" min={50} max={230} value={form.height_cm} onChange={set('height_cm')} className={fieldClass} />
          </Field>
          <Field label="Weight kg">
            <input type="number" min={10} max={200} value={form.weight_kg} onChange={set('weight_kg')} className={fieldClass} />
          </Field>
        </div>

        <p className="pt-2 font-display text-xs uppercase tracking-wider text-straw">Parent / guardian</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input maxLength={80} value={form.guardian_first_name} onChange={set('guardian_first_name')} className={fieldClass} />
          </Field>
          <Field label="Last name">
            <input maxLength={80} value={form.guardian_last_name} onChange={set('guardian_last_name')} className={fieldClass} />
          </Field>
          <Field label="Phone">
            <input type="tel" maxLength={40} value={form.guardian_phone} onChange={set('guardian_phone')} className={fieldClass} />
          </Field>
          <Field label="Email">
            <input type="email" maxLength={200} value={form.guardian_email} onChange={set('guardian_email')} className={fieldClass} />
          </Field>
        </div>

        {error && <p className="rounded-md bg-hanko/10 px-3 py-2 text-sm text-hanko-text">{error}</p>}

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
