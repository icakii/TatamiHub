import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface ClubChannels {
  in_app: boolean
  email: boolean
  viber: boolean
  sms: boolean
}

export interface Club {
  id: string
  slug: string
  name: string
  status: 'draft' | 'live' | 'paused'
}

export interface ClubWithChannels extends Club {
  channels: ClubChannels
}

export function useClubs() {
  return useQuery({
    queryKey: ['clubs'],
    queryFn: async (): Promise<Club[]> => {
      const { data, error } = await supabase.from('clubs').select('id, slug, name, status').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useClub(clubId: string | undefined) {
  return useQuery({
    queryKey: ['club', clubId],
    queryFn: async (): Promise<ClubWithChannels> => {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, slug, name, status, channels')
        .eq('id', clubId as string)
        .single()
      if (error) throw error
      return data as unknown as ClubWithChannels
    },
    enabled: !!clubId,
  })
}

export function useUpdateClubStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      clubId,
      status,
    }: {
      clubId: string
      status: 'live' | 'paused'
    }) => {
      const { error } = await supabase.from('clubs').update({ status }).eq('id', clubId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      queryClient.invalidateQueries({ queryKey: ['billing'] })
    },
  })
}
