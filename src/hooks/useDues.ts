import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

// Student dues (members paying their club), as opposed to useBilling (clubs
// paying us). Same `payments` table KimeClub's coach panel records into.

export interface DuesPayment {
  id: string
  member_id: string
  amount_cents: number
  currency: string
  method: 'cash' | 'card' | 'bank' | 'online'
  period_start: string
  period_end: string
  status: 'paid' | 'due' | 'overdue' | 'waived'
  created_at: string
}

export function useClubPayments(clubId: string | undefined) {
  return useQuery({
    queryKey: ['club-payments', clubId],
    queryFn: async (): Promise<DuesPayment[]> => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, member_id, amount_cents, currency, method, period_start, period_end, status, created_at')
        .eq('club_id', clubId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as DuesPayment[]
    },
    enabled: !!clubId,
  })
}

// Next period starts the day after the member's current paid-through date,
// or today if they've never paid / lapsed, and runs one calendar month.
function nextPeriod(paidThrough: string | undefined): { start: string; end: string } {
  const today = new Date()
  let start = today
  if (paidThrough) {
    const after = new Date(`${paidThrough}T00:00:00`)
    after.setDate(after.getDate() + 1)
    if (after > today) start = after
  }
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  end.setDate(end.getDate() - 1)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export function useRecordDuesPayment(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      memberId: string
      amountCents: number
      method: DuesPayment['method']
      paidThrough: string | undefined
    }) => {
      const { start, end } = nextPeriod(input.paidThrough)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { error } = await supabase.from('payments').insert({
        club_id: clubId,
        member_id: input.memberId,
        amount_cents: input.amountCents,
        currency: 'EUR',
        method: input.method,
        period_start: start,
        period_end: end,
        status: 'paid',
        recorded_by: user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-payments', clubId] })
      queryClient.invalidateQueries({ queryKey: ['club-overview', clubId] })
    },
  })
}
