import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface Audience {
  all?: boolean
  belt_ids?: string[]
}

export interface Announcement {
  id: string
  title: string
  body_bg: string
  body_en: string | null
  audience: Audience
  channels: string[]
  created_at: string
  sent_at: string | null
}

export function useAnnouncements(clubId: string | undefined) {
  return useQuery({
    queryKey: ['announcements', clubId],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, body_bg, body_en, audience, channels, created_at, sent_at')
        .eq('club_id', clubId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as Announcement[]
    },
    enabled: !!clubId,
  })
}

async function resolveRecipientIds(clubId: string, audience: Audience): Promise<string[]> {
  let query = supabase.from('members').select('id').eq('club_id', clubId).not('user_id', 'is', null)
  if (!audience.all && audience.belt_ids && audience.belt_ids.length > 0) {
    query = query.in('belt_id', audience.belt_ids)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((m) => m.id)
}

export function useRecipientCount(clubId: string | undefined, audience: Audience) {
  return useQuery({
    queryKey: ['recipient-count', clubId, audience],
    queryFn: () => resolveRecipientIds(clubId as string, audience),
    enabled: !!clubId,
    select: (ids) => ids.length,
  })
}

interface SendAnnouncementInput {
  clubId: string
  title: string
  bodyBg: string
  bodyEn: string
  audience: Audience
  sendEmail: boolean
}

export function useSendAnnouncement(clubId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SendAnnouncementInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const channels = ['in_app', ...(input.sendEmail ? ['email'] : [])]

      const { data: announcement, error: insertError } = await supabase
        .from('announcements')
        .insert({
          club_id: input.clubId,
          title: input.title,
          body_bg: input.bodyBg,
          body_en: input.bodyEn || null,
          audience: input.audience,
          channels,
          created_by: user?.id,
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      const recipientIds = await resolveRecipientIds(input.clubId, input.audience)
      if (recipientIds.length > 0) {
        const { error: notifyError } = await supabase.from('notifications').insert(
          recipientIds.map((memberId) => ({
            club_id: input.clubId,
            member_id: memberId,
            announcement_id: announcement.id,
            title: input.title,
            body: input.bodyBg,
          })),
        )
        if (notifyError) throw notifyError
      }

      if (input.sendEmail) {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        const { data, error } = await supabase.functions.invoke('send-announcement', {
          body: { announcement_id: announcement.id },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (error) throw error
        if (data?.error) throw new Error(data.error)
      } else {
        await supabase
          .from('announcements')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', announcement.id)
      }

      return announcement
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', clubId] })
    },
  })
}
