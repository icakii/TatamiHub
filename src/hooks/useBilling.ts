import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { localISODate } from '../lib/date'

export interface ClubBilling {
  club_id: string
  plan: string
  first_month_price_cents: number | null
  monthly_price_cents: number
  build_fee_cents: number
  paid_until: string | null
  notes: string | null
  club: { name: string; status: 'draft' | 'live' | 'paused' }
}

export function useBilling() {
  return useQuery({
    queryKey: ['billing'],
    queryFn: async (): Promise<ClubBilling[]> => {
      const { data, error } = await supabase
        .from('club_billing')
        .select(
          'club_id, plan, first_month_price_cents, monthly_price_cents, build_fee_cents, paid_until, notes, club:clubs(name, status)',
        )
        .order('paid_until')
      if (error) throw error
      return data as unknown as ClubBilling[]
    },
  })
}

export function useMarkPaid() {
  const queryClient = useQueryClient()
  return useMutation({
    // Also books the month as income in Finance, with how it was paid.
    mutationFn: async ({ clubId, method, amountCents }: { clubId: string; method: 'cash' | 'card' | 'bank'; amountCents: number }) => {
      const { data: current, error: fetchError } = await supabase
        .from('club_billing')
        .select('paid_until')
        .eq('club_id', clubId)
        .single()
      if (fetchError) throw fetchError

      const base = current.paid_until ? new Date(current.paid_until) : new Date()
      const next = new Date(Math.max(base.getTime(), Date.now()))
      next.setMonth(next.getMonth() + 1)

      const { error } = await supabase
        .from('club_billing')
        .update({ paid_until: localISODate(next) })
        .eq('club_id', clubId)
      if (error) throw error

      if (amountCents > 0) {
        const { error: ledgerError } = await supabase.from('ledger_entries').insert({
          kind: 'income',
          amount_cents: amountCents,
          category: 'Subscription',
          club_id: clubId,
          method,
          description: `Monthly fee until ${localISODate(next)}`,
        })
        if (ledgerError) throw ledgerError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
    },
  })
}
