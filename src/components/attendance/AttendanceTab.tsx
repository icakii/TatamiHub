import { useMemo, useState } from 'react'
import { StatTile } from '../ui'
import { useClubAttendance } from '../../hooks/useAttendance'
import { useMembers } from '../../hooks/useMembers'

const RANGES = [7, 30, 90] as const

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export function AttendanceTab({ clubId }: { clubId: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30)
  const since = useMemo(() => daysAgo(range), [range])
  const { data: rows, isLoading } = useClubAttendance(clubId, since)
  const { data: members } = useMembers(clubId)

  const { perStudent, sessions, avgRate } = useMemo(() => {
    const byMember = new Map<string, { present: number; total: number; last?: string }>()
    const bySession = new Map<string, { date: string; title: string; present: number; total: number }>()
    for (const r of rows ?? []) {
      const m = byMember.get(r.member_id) ?? { present: 0, total: 0 }
      m.total += 1
      if (r.status === 'present') {
        m.present += 1
        if (!m.last || r.session_date > m.last) m.last = r.session_date
      }
      byMember.set(r.member_id, m)

      const key = `${r.class_id}|${r.session_date}`
      const s = bySession.get(key) ?? { date: r.session_date, title: r.class?.title ?? '-', present: 0, total: 0 }
      s.total += 1
      if (r.status === 'present') s.present += 1
      bySession.set(key, s)
    }
    const students = (members ?? []).filter((m) => m.role === 'student' && m.status !== 'left')
    const perStudent = students
      .map((m) => ({ member: m, ...(byMember.get(m.id) ?? { present: 0, total: 0 }) }))
      .sort((a, b) => a.present / (a.total || 1) - b.present / (b.total || 1))
    const marked = (rows ?? []).length
    const present = (rows ?? []).filter((r) => r.status === 'present').length
    return {
      perStudent,
      sessions: [...bySession.values()].sort((a, b) => b.date.localeCompare(a.date)),
      avgRate: marked ? Math.round((present / marked) * 100) : null,
    }
  }, [rows, members])

  const struggling = perStudent.filter((s) => s.total > 0 && s.present / s.total < 0.5).length

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Marked by the club's coach or owner from their admin panel.</p>
        <div className="flex gap-1 rounded-lg border border-line bg-panel p-1 font-display text-xs uppercase tracking-wider">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 uppercase transition-colors ${
                range === r ? 'bg-raised text-text' : 'text-muted hover:text-text'
              }`}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Sessions marked" value={sessions.length} accent="bg-straw" />
        <StatTile label="Average attendance" value={avgRate == null ? '-' : `${avgRate}%`} accent="bg-sage" />
        <StatTile label="Below 50%" value={struggling} accent="bg-hanko" hint="students who may be drifting away" />
      </div>

      {isLoading && <p className="text-muted">...</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="self-start overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-panel text-left text-xs uppercase tracking-wide text-muted">
                <th className="p-3">Student</th>
                <th className="p-3">Attended</th>
                <th className="p-3 w-1/3">Rate</th>
                <th className="p-3">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {perStudent.map(({ member, present, total, last }) => {
                const rate = total ? Math.round((present / total) * 100) : null
                return (
                  <tr key={member.id} className="border-b border-line transition-colors last:border-0 hover:bg-panel/60">
                    <td className="p-3 text-text">{member.full_name}</td>
                    <td className="p-3 text-muted">
                      {present} / {total}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                          <div
                            className={`h-full rounded-full transition-[width] duration-700 ${
                              rate != null && rate < 50 ? 'bg-hanko' : 'bg-sage'
                            }`}
                            style={{ width: `${rate ?? 0}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-xs text-muted">
                          {rate == null ? '-' : `${rate}%`}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted">{last ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-straw">Recent sessions</h3>
          <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-panel">
            {!isLoading && sessions.length === 0 && (
              <p className="p-4 text-sm text-muted">Nothing marked in this period yet.</p>
            )}
            {sessions.slice(0, 12).map((s) => (
              <div key={`${s.title}-${s.date}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-text">{s.title}</p>
                  <p className="font-mono text-xs text-muted">{s.date}</p>
                </div>
                <span className="shrink-0 rounded-full bg-raised px-2.5 py-1 font-mono text-xs text-text">
                  {s.present}/{s.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
