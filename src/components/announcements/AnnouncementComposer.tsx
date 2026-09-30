import { useState, type FormEvent } from 'react'
import type { ClubChannels } from '../../hooks/useClubs'
import { useBelts } from '../../hooks/useMembers'
import { useRecipientCount, useSendAnnouncement, type Audience } from '../../hooks/useAnnouncements'

export function AnnouncementComposer({
  clubId,
  channels,
}: {
  clubId: string
  channels: ClubChannels
}) {
  const { data: belts } = useBelts(clubId)
  const sendAnnouncement = useSendAnnouncement(clubId)

  const [title, setTitle] = useState('')
  const [bodyBg, setBodyBg] = useState('')
  const [bodyEn, setBodyEn] = useState('')
  const [audienceMode, setAudienceMode] = useState<'all' | 'belts'>('all')
  const [selectedBelts, setSelectedBelts] = useState<string[]>([])
  const [sendEmail, setSendEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const audience: Audience =
    audienceMode === 'all' ? { all: true } : { belt_ids: selectedBelts }
  const { data: recipientCount } = useRecipientCount(clubId, audience)

  function toggleBelt(beltId: string) {
    setSelectedBelts((prev) =>
      prev.includes(beltId) ? prev.filter((id) => id !== beltId) : [...prev, beltId],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    try {
      await sendAnnouncement.mutateAsync({ clubId, title, bodyBg, bodyEn, audience, sendEmail })
      setResult(`Sent to ${recipientCount ?? 0} recipient(s).`)
      setTitle('')
      setBodyBg('')
      setBodyEn('')
      setAudienceMode('all')
      setSelectedBelts([])
      setSendEmail(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-line bg-panel p-6">
      <h2 className="font-display text-sm uppercase tracking-wide text-text">New announcement</h2>

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
        <span className="block text-xs uppercase tracking-wide text-muted">Message (Bulgarian)</span>
        <textarea
          required
          rows={3}
          value={bodyBg}
          onChange={(e) => setBodyBg(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-text outline-none focus:border-hanko-text"
        />
      </label>

      <label className="block">
        <span className="block text-xs uppercase tracking-wide text-muted">
          Message (English, optional)
        </span>
        <textarea
          rows={2}
          value={bodyEn}
          onChange={(e) => setBodyEn(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-text outline-none focus:border-hanko-text"
        />
      </label>

      <fieldset>
        <legend className="text-xs uppercase tracking-wide text-muted">Audience</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-text">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={audienceMode === 'all'}
              onChange={() => setAudienceMode('all')}
            />
            All members
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={audienceMode === 'belts'}
              onChange={() => setAudienceMode('belts')}
            />
            Specific belts
          </label>
        </div>
        {audienceMode === 'belts' && (
          <div className="mt-2 flex flex-wrap gap-2">
            {belts?.map((belt) => (
              <label
                key={belt.id}
                className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted"
              >
                <input
                  type="checkbox"
                  checked={selectedBelts.includes(belt.id)}
                  onChange={() => toggleBelt(belt.id)}
                />
                {belt.name_bg}
              </label>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted">
          Reaches {recipientCount ?? 0} member(s) with an account.
        </p>
      </fieldset>

      <fieldset>
        <legend className="text-xs uppercase tracking-wide text-muted">Channels</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-text">
          <label className="flex items-center gap-2 opacity-60">
            <input type="checkbox" checked readOnly />
            In-app
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sendEmail}
              disabled={!channels.email}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Email
          </label>
          <span className="flex items-center gap-2 text-muted opacity-50">
            <input type="checkbox" disabled />
            Viber (later)
          </span>
          <span className="flex items-center gap-2 text-muted opacity-50">
            <input type="checkbox" disabled />
            SMS (later)
          </span>
        </div>
      </fieldset>

      {error && <p className="text-sm text-hanko-text">{error}</p>}
      {result && <p className="text-sm text-sage">{result}</p>}

      <button
        type="submit"
        disabled={sendAnnouncement.isPending}
        className="min-h-11 rounded-md bg-hanko px-6 font-display text-sm uppercase tracking-wide text-text disabled:opacity-60"
      >
        {sendAnnouncement.isPending ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}
