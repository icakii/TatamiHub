import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface Competition {
  id: string
  name: string
  location: string | null
  event_date: string
  notes: string | null
}

export interface CompetitionEntry {
  id: string
  competition_id: string
  member_id: string
  category: string | null
  placement: string | null
  medal: 'gold' | 'silver' | 'bronze' | null
  note: string | null
}

export function useCompetitions(clubId: string | undefined) {
  return useQuery({
    queryKey: ['competitions', clubId],
    queryFn: async (): Promise<Competition[]> => {
      const { data, error } = await supabase
        .from('competitions')
        .select('id, name, location, event_date, notes')
        .eq('club_id', clubId as string)
        .order('event_date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!clubId,
  })
}

export function useCompetitionEntries(competitionId: string | undefined) {
  return useQuery({
    queryKey: ['competition-entries', competitionId],
    queryFn: async (): Promise<(CompetitionEntry & { member: { full_name: string } })[]> => {
      const { data, error } = await supabase
        .from('competition_entries')
        .select(
          'id, competition_id, member_id, category, placement, medal, note, member:members(full_name)',
        )
        .eq('competition_id', competitionId as string)
      if (error) throw error
      return data as unknown as (CompetitionEntry & { member: { full_name: string } })[]
    },
    enabled: !!competitionId,
  })
}

export function useCreateCompetition(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; location?: string; event_date: string }) => {
      const { error } = await supabase.from('competitions').insert({ club_id: clubId, ...input })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions', clubId] })
    },
  })
}

export function useDeleteCompetition(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (competitionId: string) => {
      const { error } = await supabase.from('competitions').delete().eq('id', competitionId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions', clubId] })
    },
  })
}

export function useAddEntry(clubId: string | undefined, competitionId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { member_id: string; category?: string }) => {
      const { error } = await supabase
        .from('competition_entries')
        .insert({ club_id: clubId, competition_id: competitionId, ...input })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-entries', competitionId] })
    },
  })
}

export function useUpdateEntry(competitionId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      entryId,
      updates,
    }: {
      entryId: string
      updates: Partial<Pick<CompetitionEntry, 'placement' | 'medal' | 'note'>>
    }) => {
      const { error } = await supabase.from('competition_entries').update(updates).eq('id', entryId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-entries', competitionId] })
    },
  })
}

export function useRemoveEntry(competitionId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.from('competition_entries').delete().eq('id', entryId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-entries', competitionId] })
    },
  })
}
