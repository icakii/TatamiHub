import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface Belt {
  id: string
  rank: number
  name_bg: string
  name_en: string
  color_hex: string
  grade_bg: string | null
}

// "Кафяво · 3 кю", or just the color when the club has no grades.
export function beltLabel(b: Pick<Belt, 'name_bg' | 'grade_bg'>): string {
  return b.grade_bg ? `${b.name_bg} · ${b.grade_bg}` : b.name_bg
}

export interface Member {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: 'owner' | 'coach' | 'student'
  status: 'active' | 'trial' | 'paused' | 'left'
  birth_year: number | null
  user_id: string | null
  group_id: string | null
  guardian_first_name: string | null
  guardian_last_name: string | null
  guardian_phone: string | null
  guardian_email: string | null
  monthly_fee_cents: number | null
  photo_path: string | null
  height_cm: number | null
  weight_kg: number | null
  belt: Belt | null
}

export function useMembers(clubId: string | undefined) {
  return useQuery({
    queryKey: ['members', clubId],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('members')
        .select(
          'id, full_name, email, phone, role, status, birth_year, user_id, group_id, guardian_first_name, guardian_last_name, guardian_phone, guardian_email, monthly_fee_cents, photo_path, height_cm, weight_kg, belt:belts(id, rank, name_bg, name_en, color_hex, grade_bg)',
        )
        .eq('club_id', clubId as string)
        .order('full_name')
      if (error) throw error
      return data as unknown as Member[]
    },
    enabled: !!clubId,
  })
}

export function useBelts(clubId: string | undefined) {
  return useQuery({
    queryKey: ['belts', clubId],
    queryFn: async (): Promise<Belt[]> => {
      const { data, error } = await supabase
        .from('belts')
        .select('id, rank, name_bg, name_en, color_hex, grade_bg')
        .eq('club_id', clubId as string)
        .order('rank')
      if (error) throw error
      return data
    },
    enabled: !!clubId,
  })
}

export function useUpdateMember(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      memberId,
      updates,
    }: {
      memberId: string
      updates: Partial<{
        belt_id: string | null
        status: Member['status']
        group_id: string | null
        guardian_first_name: string | null
        guardian_last_name: string | null
        guardian_phone: string | null
        guardian_email: string | null
        monthly_fee_cents: number | null
        full_name: string
        email: string | null
        phone: string | null
        birth_year: number | null
        height_cm: number | null
        weight_kg: number | null
      }>
    }) => {
      const { error } = await supabase.from('members').update(updates).eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', clubId] })
    },
  })
}

// Downscale to a 512px JPEG in the browser: small uploads, and no EXIF
// (location etc.) from phone photos. Student photos live in a private bucket.
async function toSmallJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read image'))), 'image/jpeg', 0.85),
  )
}

export function useUploadMemberPhoto(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ member, file }: { member: Member; file: File }) => {
      const blob = await toSmallJpeg(file)
      const path = `${clubId}/${member.id}/${Date.now()}.jpg`
      const { error } = await supabase.storage.from('member-photos').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      const { error: updateError } = await supabase.from('members').update({ photo_path: path }).eq('id', member.id)
      if (updateError) throw updateError
      if (member.photo_path) await supabase.storage.from('member-photos').remove([member.photo_path])
      return path
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', clubId] }),
  })
}

export function usePhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['photo-url', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('member-photos').createSignedUrl(path as string, 3600)
      if (error) throw error
      return data.signedUrl
    },
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
  })
}

interface CreateMemberAccountInput {
  club_id: string
  member_id?: string
  full_name?: string
  email: string
  password: string
  belt_id?: string
  group_id?: string
  role?: 'student' | 'coach'
  birth_year?: number
  phone?: string
  guardian_consent?: boolean
  monthly_fee_cents?: number
}

export function useCreateMemberAccount(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateMemberAccountInput) => {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const { data, error } = await supabase.functions.invoke('create-member-account', {
        body: input,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data.member as Member
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', clubId] })
    },
  })
}
