import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface ClubOverview {
  activeMembers: number
  newThisMonth: number
  trainingsPerWeek: number
  revenueThisMonthCents: number
  unpaidCount: number
}

function monthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export function useClubOverview(clubId: string | undefined) {
  return useQuery({
    queryKey: ['club-overview', clubId],
    queryFn: async (): Promise<ClubOverview> => {
      const today = new Date().toISOString().slice(0, 10)
      const { start: monthStart, end: monthEnd } = monthRange(new Date())

      const [activeMembers, newThisMonth, trainingsPerWeek, paidThisMonth, unpaid] =
        await Promise.all([
          supabase
            .from('members')
            .select('id', { count: 'exact', head: true })
            .eq('club_id', clubId as string)
            .eq('status', 'active'),
          supabase
            .from('members')
            .select('id', { count: 'exact', head: true })
            .eq('club_id', clubId as string)
            .gte('joined_at', monthStart)
            .lte('joined_at', monthEnd),
          supabase
            .from('classes')
            .select('id', { count: 'exact', head: true })
            .eq('club_id', clubId as string),
          supabase
            .from('payments')
            .select('amount_cents')
            .eq('club_id', clubId as string)
            .eq('status', 'paid')
            .gte('created_at', `${monthStart}T00:00:00Z`)
            .lte('created_at', `${monthEnd}T23:59:59Z`),
          supabase
            .from('payments')
            .select('member_id')
            .eq('club_id', clubId as string)
            .in('status', ['due', 'overdue'])
            .lte('period_start', today)
            .gte('period_end', today),
        ])

      if (activeMembers.error) throw activeMembers.error
      if (newThisMonth.error) throw newThisMonth.error
      if (trainingsPerWeek.error) throw trainingsPerWeek.error
      if (paidThisMonth.error) throw paidThisMonth.error
      if (unpaid.error) throw unpaid.error

      const revenueThisMonthCents = (paidThisMonth.data ?? []).reduce(
        (sum, row) => sum + row.amount_cents,
        0,
      )
      const unpaidCount = new Set((unpaid.data ?? []).map((row) => row.member_id)).size

      return {
        activeMembers: activeMembers.count ?? 0,
        newThisMonth: newThisMonth.count ?? 0,
        trainingsPerWeek: trainingsPerWeek.count ?? 0,
        revenueThisMonthCents,
        unpaidCount,
      }
    },
    enabled: !!clubId,
  })
}
