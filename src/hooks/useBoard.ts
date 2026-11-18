import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export type BoardColumn = 'notes' | 'todo' | 'doing' | 'done'
export const COLUMNS: { id: BoardColumn; label: string; accent: string }[] = [
  { id: 'notes', label: 'Notes', accent: 'bg-straw' },
  { id: 'todo', label: 'To do', accent: 'bg-hanko' },
  { id: 'doing', label: 'Doing', accent: 'bg-amber' },
  { id: 'done', label: 'Done', accent: 'bg-sage' },
]

export interface NoteLink {
  label: string
  url: string
}

export interface TeamNote {
  id: string
  title: string
  body: string
  board_column: BoardColumn
  position: number
  pinned: boolean
  club_id: string | null
  due_on: string | null
  links: NoteLink[]
  author_name: string | null
  created_at: string
  updated_by_name: string | null
  updated_at: string
  club: { name: string } | null
  team_note_files: { count: number }[]
  team_note_comments: { count: number }[]
}

export interface NoteComment {
  id: string
  body: string
  author_name: string | null
  created_at: string
}

export interface NoteFile {
  id: string
  path: string
  name: string
  mime: string | null
  size_bytes: number | null
  author_name: string | null
  created_at: string
}

// One realtime channel for the whole board: any change (from the other
// founder or from Claude) refreshes what's on screen.
export function useBoardLive() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['board'] })
    const channel = supabase
      .channel('team-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_notes' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_note_comments' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_note_files' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

export function useNotes() {
  return useQuery({
    queryKey: ['board', 'notes'],
    queryFn: async (): Promise<TeamNote[]> => {
      const { data, error } = await supabase
        .from('team_notes')
        .select('*, club:clubs(name), team_note_files(count), team_note_comments(count)')
        .order('pinned', { ascending: false })
        .order('position', { ascending: false })
      if (error) throw error
      return data as unknown as TeamNote[]
    },
  })
}

export function useNoteDetail(noteId: string | null) {
  return useQuery({
    queryKey: ['board', 'detail', noteId],
    queryFn: async () => {
      const [comments, files] = await Promise.all([
        supabase.from('team_note_comments').select('id, body, author_name, created_at').eq('note_id', noteId!).order('created_at'),
        supabase.from('team_note_files').select('id, path, name, mime, size_bytes, author_name, created_at').eq('note_id', noteId!).order('created_at'),
      ])
      if (comments.error) throw comments.error
      if (files.error) throw files.error
      return { comments: comments.data as NoteComment[], files: files.data as NoteFile[] }
    },
    enabled: !!noteId,
  })
}

type NoteFields = Partial<Pick<TeamNote, 'title' | 'body' | 'board_column' | 'pinned' | 'club_id' | 'due_on' | 'links' | 'position'>>

export function useSaveNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, fields }: { id?: string; fields: NoteFields }) => {
      if (id) {
        const { error } = await supabase.from('team_notes').update(fields).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase.from('team_notes').insert(fields).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board'] }),
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: files } = await supabase.from('team_note_files').select('path').eq('note_id', id)
      if (files?.length) await supabase.storage.from('team-files').remove(files.map((f) => f.path))
      const { error } = await supabase.from('team_notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board'] }),
  })
}

export function useAddComment(noteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('team_note_comments').insert({ note_id: noteId, body })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board'] }),
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('team_note_comments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board'] }),
  })
}

export function useUploadFiles(noteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
        const path = `notes/${noteId}/${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage.from('team-files').upload(path, file, { contentType: file.type })
        if (error) throw error
        const { error: rowError } = await supabase
          .from('team_note_files')
          .insert({ note_id: noteId, path, name: file.name.slice(0, 200), mime: file.type || null, size_bytes: file.size })
        if (rowError) throw rowError
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board'] }),
  })
}

export function useDeleteFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: NoteFile) => {
      await supabase.storage.from('team-files').remove([file.path])
      const { error } = await supabase.from('team_note_files').delete().eq('id', file.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board'] }),
  })
}

// Thumbnails for image files (signed, private bucket).
export function useSignedUrls(paths: string[]) {
  return useQuery({
    queryKey: ['board', 'signed', paths],
    queryFn: async () => {
      if (!paths.length) return {} as Record<string, string>
      const { data, error } = await supabase.storage.from('team-files').createSignedUrls(paths, 3600)
      if (error) throw error
      return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl as string])) as Record<string, string>
    },
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
  })
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
