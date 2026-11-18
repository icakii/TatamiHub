import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type LedgerKind = 'income' | 'expense'
export type PayMethod = 'cash' | 'card' | 'bank' | 'other'

export interface LedgerEntry {
  id: string
  kind: LedgerKind
  amount_cents: number
  occurred_on: string
  category: string
  description: string | null
  club_id: string | null
  method: PayMethod
  receipt_path: string | null
  author_name: string | null
  created_at: string
  club: { name: string } | null
}

export const CATEGORIES: Record<LedgerKind, string[]> = {
  income: ['Subscription', 'Build fee', 'Domain', 'Extra work', 'Other'],
  expense: ['Hosting', 'Domain', 'Software', 'Ads', 'Equipment', 'Travel', 'Accounting', 'Taxes', 'Other'],
}

export const METHODS: PayMethod[] = ['bank', 'cash', 'card', 'other']

export function useLedger() {
  return useQuery({
    queryKey: ['ledger'],
    queryFn: async (): Promise<LedgerEntry[]> => {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('id, kind, amount_cents, occurred_on, category, description, club_id, method, receipt_path, author_name, created_at, club:clubs(name)')
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as LedgerEntry[]
    },
  })
}

export interface NewEntry {
  kind: LedgerKind
  amount_cents: number
  occurred_on: string
  category: string
  description: string | null
  club_id: string | null
  method: PayMethod
  receipt?: File | null
}

export function useAddEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ receipt, ...entry }: NewEntry) => {
      let receipt_path: string | null = null
      if (receipt) {
        const ext = receipt.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
        receipt_path = `receipts/${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage.from('team-files').upload(receipt_path, receipt, { contentType: receipt.type })
        if (error) throw error
      }
      const { error } = await supabase.from('ledger_entries').insert({ ...entry, receipt_path })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ledger'] }),
  })
}

export function useDeleteEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (entry: LedgerEntry) => {
      const { error } = await supabase.from('ledger_entries').delete().eq('id', entry.id)
      if (error) throw error
      if (entry.receipt_path) await supabase.storage.from('team-files').remove([entry.receipt_path])
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ledger'] }),
  })
}

// Private files open through a short-lived link.
export async function openPrivateFile(path: string) {
  const win = window.open('', '_blank')
  const { data, error } = await supabase.storage.from('team-files').createSignedUrl(path, 300)
  if (error || !data) {
    win?.close()
    throw error ?? new Error('No link')
  }
  if (win) win.location.href = data.signedUrl
}

export const eur = (cents: number) =>
  `${(cents / 100).toLocaleString('bg-BG', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`
