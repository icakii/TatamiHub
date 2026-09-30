import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'

export function useIsPlatformAdmin() {
  const { session } = useAuth()
  const userId = session?.user.id

  return useQuery({
    queryKey: ['is-platform-admin', userId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('is_platform_admin')
      if (error) throw error
      return data as boolean
    },
    enabled: !!userId,
  })
}
