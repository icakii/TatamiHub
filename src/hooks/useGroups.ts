import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface Group {
  id: string
  club_id: string
  name: string
  description: string | null
  room: string | null
}

export function useGroups(clubId: string | undefined) {
  return useQuery({
    queryKey: ['groups', clubId],
    queryFn: async (): Promise<Group[]> => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, club_id, name, description, room')
        .eq('club_id', clubId as string)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: !!clubId,
  })
}

export function useCreateGroup(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; description: string | null; room: string | null }) => {
      const { error } = await supabase
        .from('groups')
        .insert({ club_id: clubId, ...input })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', clubId] })
    },
  })
}

export function useUpdateGroup(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      updates,
    }: {
      groupId: string
      updates: Partial<{ name: string; description: string | null; room: string | null }>
    }) => {
      const { error } = await supabase.from('groups').update(updates).eq('id', groupId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', clubId] })
    },
  })
}

export function useDeleteGroup(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', groupId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', clubId] })
      queryClient.invalidateQueries({ queryKey: ['members', clubId] })
      queryClient.invalidateQueries({ queryKey: ['classes', clubId] })
    },
  })
}
