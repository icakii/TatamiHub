import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface ClassRow {
  id: string
  title: string
  weekday: number
  start_time: string
  duration_min: number
  belt_min_rank: number | null
  belt_max_rank: number | null
  group_id: string | null
  room: string | null
}

export function useClasses(clubId: string | undefined) {
  return useQuery({
    queryKey: ['classes', clubId],
    queryFn: async (): Promise<ClassRow[]> => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, title, weekday, start_time, duration_min, belt_min_rank, belt_max_rank, group_id, room')
        .eq('club_id', clubId as string)
        .order('weekday')
        .order('start_time')
      if (error) throw error
      return data
    },
    enabled: !!clubId,
  })
}

interface ClassInput {
  title: string
  weekday: number
  start_time: string
  duration_min: number
  group_id: string | null
  room: string | null
}

export function useCreateClass(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClassInput) => {
      const { error } = await supabase.from('classes').insert({ club_id: clubId, ...input })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', clubId] })
    },
  })
}

export function useUpdateClass(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ classId, updates }: { classId: string; updates: Partial<ClassInput> }) => {
      const { error } = await supabase.from('classes').update(updates).eq('id', classId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', clubId] })
    },
  })
}

export function useDeleteClass(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (classId: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', classId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', clubId] })
    },
  })
}
