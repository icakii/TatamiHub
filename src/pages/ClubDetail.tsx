import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnnouncementComposer } from '../components/announcements/AnnouncementComposer'
import { AnnouncementHistory } from '../components/announcements/AnnouncementHistory'
import { AttendanceTab } from '../components/attendance/AttendanceTab'
import { CompetitionsTab } from '../components/competitions/CompetitionsTab'
import { GroupsTab } from '../components/groups/GroupsTab'
import { AddMemberModal } from '../components/members/AddMemberModal'
import { CreateLoginModal } from '../components/members/CreateLoginModal'
import { EditGuardianModal } from '../components/members/EditGuardianModal'
import { PaymentsTab } from '../components/payments/PaymentsTab'
import { ScheduleTab } from '../components/schedule/ScheduleTab'
import { StatTile, StatusBadge } from '../components/ui'
import { useClub } from '../hooks/useClubs'
import { useClubOverview } from '../hooks/useClubOverview'
import { useGroups } from '../hooks/useGroups'
import { useBelts, useMembers, useUpdateMember, type Member } from '../hooks/useMembers'

const STATUSES = ['active', 'trial', 'paused', 'left'] as const
const TABS = ['overview', 'members', 'payments', 'attendance', 'groups', 'schedule', 'competitions', 'announcements'] as const
type Tab = (typeof TABS)[number]

export function ClubDetail() {
  const { clubId } = useParams<{ clubId: string }>()
  const { data: club } = useClub(clubId)
  const [tab, setTab] = useState<Tab>('overview')

  if (!clubId || !club) return null

  return (
    <div className="px-6 py-8">
      <Link to="/" className="text-xs uppercase tracking-wide text-muted transition-colors hover:text-hanko-text">
        &larr; Clubs
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-raised font-display text-xl uppercase text-straw ring-1 ring-line">
          {club.name.charAt(0)}
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-text">{club.name}</h1>
            <StatusBadge status={club.status} />
          </div>
          <p className="font-mono text-xs text-muted">{club.slug}</p>
        </div>
      </div>

      <nav className="mt-6 flex gap-1 overflow-x-auto rounded-lg border border-line bg-panel p-1 font-display text-xs uppercase tracking-wider">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-md px-3.5 py-2 uppercase transition-colors ${
              tab === t ? 'bg-raised text-text shadow-[inset_0_-2px_0_var(--color-hanko)]' : 'text-muted hover:text-text'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <OverviewTab clubId={clubId} />}
      {tab === 'members' && <MembersTab clubId={clubId} />}
      {tab === 'payments' && <PaymentsTab clubId={clubId} />}
      {tab === 'attendance' && <AttendanceTab clubId={clubId} />}
      {tab === 'groups' && <GroupsTab clubId={clubId} />}
      {tab === 'schedule' && <ScheduleTab clubId={clubId} />}
      {tab === 'competitions' && <CompetitionsTab clubId={clubId} />}
      {tab === 'announcements' && (
        <div className="mt-6">
          <AnnouncementComposer clubId={clubId} channels={club.channels} />
          <AnnouncementHistory clubId={clubId} />
        </div>
      )}
    </div>
  )
}

function formatEur(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`
}

function OverviewTab({ clubId }: { clubId: string }) {
  const { data, isLoading } = useClubOverview(clubId)

  if (isLoading || !data) {
    return <p className="mt-6 text-sm text-muted">...</p>
  }

  const tiles = [
    { label: 'Active members', value: data.activeMembers, accent: 'bg-sage' },
    { label: 'Revenue this month', value: formatEur(data.revenueThisMonthCents), accent: 'bg-straw' },
    { label: 'Unpaid fees', value: data.unpaidCount, accent: 'bg-hanko' },
    { label: 'Trainings per week', value: data.trainingsPerWeek, accent: 'bg-amber' },
    { label: 'New members this month', value: `+${data.newThisMonth}`, accent: 'bg-sage' },
    { label: 'Competitors (upcoming)', value: data.upcomingCompetitors, accent: 'bg-amber' },
  ]

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <StatTile key={tile.label} label={tile.label} value={tile.value} accent={tile.accent} />
      ))}
    </div>
  )
}

function MembersTab({ clubId }: { clubId: string }) {
  const { data: members, isLoading } = useMembers(clubId)
  const { data: belts } = useBelts(clubId)
  const { data: groups } = useGroups(clubId)
  const updateMember = useUpdateMember(clubId)

  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [loginTarget, setLoginTarget] = useState<Member | null>(null)
  const [guardianTarget, setGuardianTarget] = useState<Member | null>(null)

  const filtered = useMemo(() => {
    if (!search) return members ?? []
    return (members ?? []).filter((m) => m.full_name.toLowerCase().includes(search.toLowerCase()))
  }, [members, search])

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          className="min-h-11 w-full max-w-sm rounded-md border border-line bg-panel px-3 text-text outline-none focus:border-hanko-text"
        />
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="min-h-11 rounded-md bg-hanko px-4 font-display text-sm uppercase tracking-wide text-text"
        >
          Add member
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-panel text-left text-xs uppercase tracking-wide text-muted">
              <th className="p-3">Name</th>
              <th className="p-3">Belt</th>
              <th className="p-3">Group</th>
              <th className="p-3">Fee</th>
              <th className="p-3">Status</th>
              <th className="p-3">Guardian</th>
              <th className="p-3">Login</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted">
                  ...
                </td>
              </tr>
            )}
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="p-3">
                  <p className="text-text">{m.full_name}</p>
                  <p className="text-xs capitalize text-muted">{m.role}</p>
                </td>
                <td className="p-3">
                  <select
                    value={m.belt?.id ?? ''}
                    onChange={(e) =>
                      updateMember.mutate({
                        memberId: m.id,
                        updates: { belt_id: e.target.value || null },
                      })
                    }
                    className="min-h-11 rounded-md border border-line bg-panel px-2 text-text"
                  >
                    <option value="">-</option>
                    {belts?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name_bg}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <select
                    value={m.group_id ?? ''}
                    onChange={(e) =>
                      updateMember.mutate({
                        memberId: m.id,
                        updates: { group_id: e.target.value || null },
                      })
                    }
                    className="min-h-11 rounded-md border border-line bg-panel px-2 text-text"
                  >
                    <option value="">-</option>
                    {groups?.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={m.monthly_fee_cents != null ? m.monthly_fee_cents / 100 : ''}
                    onBlur={(e) =>
                      updateMember.mutate({
                        memberId: m.id,
                        updates: {
                          monthly_fee_cents: e.target.value
                            ? Math.round(Number(e.target.value) * 100)
                            : null,
                        },
                      })
                    }
                    className="min-h-11 w-20 rounded-md border border-line bg-panel px-2 text-text"
                  />
                </td>
                <td className="p-3">
                  <select
                    value={m.status}
                    onChange={(e) =>
                      updateMember.mutate({
                        memberId: m.id,
                        updates: { status: e.target.value as Member['status'] },
                      })
                    }
                    className="min-h-11 rounded-md border border-line bg-panel px-2 text-text capitalize"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => setGuardianTarget(m)}
                    className="text-left text-xs text-muted hover:text-hanko-text"
                  >
                    {m.guardian_first_name
                      ? [m.guardian_first_name, m.guardian_last_name].filter(Boolean).join(' ')
                      : '+ Add'}
                  </button>
                </td>
                <td className="p-3">
                  {m.user_id ? (
                    <span className="text-xs text-muted">Has account</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLoginTarget(m)}
                      className="min-h-11 rounded-md border border-line px-3 text-xs uppercase tracking-wide text-hanko-text"
                    >
                      Create login
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && <AddMemberModal clubId={clubId} onClose={() => setShowAddModal(false)} />}
      {loginTarget && (
        <CreateLoginModal clubId={clubId} member={loginTarget} onClose={() => setLoginTarget(null)} />
      )}
      {guardianTarget && (
        <EditGuardianModal
          clubId={clubId}
          member={guardianTarget}
          onClose={() => setGuardianTarget(null)}
        />
      )}
    </div>
  )
}
