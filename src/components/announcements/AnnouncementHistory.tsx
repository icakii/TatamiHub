import { useAnnouncements } from '../../hooks/useAnnouncements'

export function AnnouncementHistory({ clubId }: { clubId: string }) {
  const { data: announcements, isLoading } = useAnnouncements(clubId)

  return (
    <div className="mt-6 divide-y divide-line rounded-lg border border-line bg-panel">
      {isLoading && <p className="p-6 text-center text-muted">...</p>}
      {!isLoading && announcements?.length === 0 && (
        <p className="p-6 text-center text-muted">No announcements yet.</p>
      )}
      {announcements?.map((a) => (
        <div key={a.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-sm uppercase tracking-wide text-text">{a.title}</p>
            <span className="text-xs text-muted">
              {a.sent_at ? new Date(a.sent_at).toLocaleString() : 'Sending...'}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{a.body_bg}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted">
            {a.audience.all ? 'All members' : `${a.audience.belt_ids?.length ?? 0} belt(s)`} ·{' '}
            {a.channels.join(', ')}
          </p>
        </div>
      ))}
    </div>
  )
}
