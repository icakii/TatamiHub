import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

// Orders placed on the public Tatami site. Payment fields are written by the
// paddle-webhook function; founders move the status along from here.

export type OrderStatus = 'pending_payment' | 'paid' | 'in_progress' | 'live' | 'cancelled'

export interface Order {
  id: string
  contact_name: string
  email: string
  phone: string | null
  club_name: string
  city: string | null
  student_count: number | null
  domain_option: 'subdomain' | 'own' | 'new'
  domain: string | null
  notes: string | null
  status: OrderStatus
  paid_until: string | null
  cancel_at: string | null
  paddle_subscription_id: string | null
  club_id: string | null
  created_at: string
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, contact_name, email, phone, club_name, city, student_count, domain_option, domain, notes, status, paid_until, cancel_at, paddle_subscription_id, club_id, created_at',
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Order[]
    },
  })
}

export function useUpdateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<Order, 'status' | 'club_id'>> }) => {
      const { error } = await supabase.from('orders').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })
}
