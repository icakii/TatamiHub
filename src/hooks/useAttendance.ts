import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

// Read-only in the Hub: coaches/owners mark attendance from the club's own
// admin panel, founders just watch it here.

export interface AttendanceRow {
  member_id: string
  class_id: string
  session_date: string
  status: 'present' | 'absent'
  class: { title: string } | null
}

export function useClubAttendance(clubId: string | undefined, since: string) {
  return useQuery({
    queryKey: ['club-attendance', clubId, since],
    queryFn: async (): Promise<AttendanceRow[]> => {
      const { data, error } = await supabase
        .from('attendance')
        .select('member_id, class_id, session_date, status, class:classes(title)')
        .eq('club_id', clubId as string)
        .gte('session_date', since)
        .order('session_date', { ascending: false })
      if (error) throw error
      return data as unknown as AttendanceRow[]
    },
    enabled: !!clubId,
  })
}
