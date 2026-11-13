import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { ClubWithChannels } from '../../hooks/useClubs'
import { supabase } from '../../lib/supabaseClient'

// How the club looks in the shared app (app.tatamistudio.net/<slug>): its
// logo, accent colour and the home-screen icons. Icons are generated here in
// the browser from the logo, so a club needs nothing but one image.

const BUCKET = 'club-assets'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = URL.createObjectURL(file)
  })
}

// The logo fitted inside a square with padding. `bg` null keeps transparency.
function square(img: HTMLImageElement, size: number, pad: number, bg: string | null): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, size, size)
  }
  const box = size * (1 - 2 * pad)
  const r = Math.min(box / img.naturalWidth, box / img.naturalHeight)
  const w = img.naturalWidth * r
  const h = img.naturalHeight * r
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not render icon'))), 'image/png'))
}

function useSaveBranding(club: ClubWithChannels) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, color, iconBg }: { file: File | null; color: string; iconBg: string }) => {
      const updates: { accent_color: string; logo_path?: string } = { accent_color: color }
      if (file) {
        const img = await loadImage(file)
        const files: [string, Promise<Blob>][] = [
          ['logo.png', square(img, 512, 0, null)],
          ['icon-192.png', square(img, 192, 0.1, iconBg)],
          ['icon-512.png', square(img, 512, 0.1, iconBg)],
          // Android crops icons to its own shape: keep the logo in the safe zone.
          ['maskable-512.png', square(img, 512, 0.22, iconBg)],
          // iPhone needs an opaque icon.
          ['apple-touch-icon.png', square(img, 180, 0.1, iconBg)],
        ]
        for (const [name, blob] of files) {
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(`${club.id}/${name}`, await blob, { upsert: true, contentType: 'image/png', cacheControl: '300' })
          if (error) throw error
        }
        // The version makes phones and browsers pick up a replaced logo.
        updates.logo_path = `logo.png?v=${Date.now()}`
      }
      const { error } = await supabase.from('clubs').update(updates).eq('id', club.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['club', club.id] }),
  })
}

export function BrandingTab({ club }: { club: ClubWithChannels }) {
  const save = useSaveBranding(club)
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [color, setColor] = useState(club.accent_color)
  const [iconBg, setIconBg] = useState('#ffffff')
  const [done, setDone] = useState(false)

  const current = club.logo_path ? supabase.storage.from(BUCKET).getPublicUrl(`${club.id}/${club.logo_path}`).data.publicUrl : null
  const shown = preview ?? current

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const appUrl = `https://app.tatamistudio.net/${club.slug}`

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5 rounded-lg border border-line bg-panel p-5">
        <div>
          <p className="font-display text-sm uppercase tracking-wider text-text">Logo</p>
          <p className="mt-1 text-sm text-muted">Square works best, PNG with a transparent background ideally. We make the phone icons from it.</p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="min-h-11 rounded-md border border-line px-4 text-xs uppercase tracking-wide text-hanko-text"
            >
              {shown ? 'Replace logo' : 'Upload logo'}
            </button>
            {file && <span className="truncate text-xs text-muted">{file.name}</span>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              setDone(false)
              if (preview) URL.revokeObjectURL(preview)
              setPreview(f ? URL.createObjectURL(f) : null)
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="block font-display text-sm uppercase tracking-wider text-text">Accent colour</span>
            <span className="mt-1 block text-sm text-muted">Buttons, the active tab and highlights.</span>
            <span className="mt-2 flex items-center gap-3">
              <input type="color" value={color} onChange={(e) => (setColor(e.target.value), setDone(false))} className="h-11 w-16 cursor-pointer rounded-md border border-line bg-ink" />
              <span className="font-mono text-sm text-muted">{color}</span>
            </span>
          </label>
          <label className="block">
            <span className="block font-display text-sm uppercase tracking-wider text-text">Icon background</span>
            <span className="mt-1 block text-sm text-muted">Behind the logo on the phone's home screen.</span>
            <span className="mt-2 flex items-center gap-3">
              <input type="color" value={iconBg} onChange={(e) => (setIconBg(e.target.value), setDone(false))} className="h-11 w-16 cursor-pointer rounded-md border border-line bg-ink" />
              <span className="font-mono text-sm text-muted">{iconBg}</span>
            </span>
          </label>
        </div>

        {save.error && <p className="rounded-md bg-hanko/10 px-3 py-2 text-sm text-hanko-text">{(save.error as Error).message}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate({ file, color, iconBg }, { onSuccess: () => (setDone(true), setFile(null)) })}
            className="min-h-11 rounded-md bg-hanko px-5 font-display text-sm uppercase tracking-wide text-text disabled:opacity-60"
          >
            {save.isPending ? 'Saving...' : 'Save branding'}
          </button>
          {done && <span className="text-sm text-sage">Saved. The app picks it up on its next load.</span>}
        </div>
        <p className="text-xs text-muted">
          App: <span className="font-mono text-text">{appUrl}</span>
        </p>
      </div>

      {/* Preview: the home-screen icon and the app header as the club will see them. */}
      <div className="rounded-lg border border-line bg-panel p-5">
        <p className="font-display text-sm uppercase tracking-wider text-text">Preview</p>
        <div className="mt-4 rounded-2xl bg-[#2f4f7a] p-6">
          <div className="mx-auto flex w-20 flex-col items-center gap-1.5">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[22%] shadow-lg" style={{ background: iconBg }}>
              {shown ? (
                <img src={shown} alt="" className="h-[80%] w-[80%] object-contain" />
              ) : (
                <span className="font-display text-xl" style={{ color }}>
                  {club.name.charAt(0)}
                </span>
              )}
            </div>
            <span className="max-w-full truncate text-[11px] text-white">{club.name}</span>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl bg-[#f3ecdd]">
          <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2.5">
            {shown ? <img src={shown} alt="" className="h-7 w-7 rounded-md object-contain" /> : <span className="h-7 w-7 rounded-md" style={{ background: color }} />}
            <span className="truncate font-display text-sm uppercase tracking-widest text-[#1f1b16]">{club.name}</span>
          </div>
          <div className="space-y-2 p-3">
            <div className="rounded-lg p-3 text-xs font-semibold uppercase tracking-wide text-white" style={{ background: color }}>
              Следваща тренировка
            </div>
            <div className="flex gap-1.5">
              {['Начало', 'График', 'Профил'].map((t, i) => (
                <span key={t} className="flex-1 rounded-md py-1.5 text-center text-[10px] uppercase" style={i === 0 ? { background: color, color: '#fff' } : { color: '#5e5648' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
