// Per-club web app manifest for the shared app (app.tatamistudio.net/<slug>).
// "Add to home screen" from /<slug> installs that club as its own app, with
// the club's name and icons. Public and read-only: it only reads live clubs
// through the anon key, same as any visitor.
//
// GET ?slug=<club-slug>&app=<app origin>. The app origin must be in
// ALLOWED_ORIGINS (or the defaults below), since start_url and scope have
// to be on the app's own origin.

const SLUG = /^[a-z0-9-]{1,40}$/
const DEFAULT_APPS = ['https://app.tatamistudio.net', 'http://localhost:5173', 'http://localhost:4173']

function allowedApps(): string[] {
  const extra = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return [...DEFAULT_APPS, ...extra]
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/manifest+json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers })

  const url = new URL(req.url)
  const slug = url.searchParams.get('slug') ?? ''
  const app = url.searchParams.get('app') ?? ''
  if (!SLUG.test(slug) || !allowedApps().includes(app)) {
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers })
  }

  const base = Deno.env.get('SUPABASE_URL')!
  const res = await fetch(
    `${base}/rest/v1/clubs?slug=eq.${slug}&status=eq.live&select=id,name,logo_path,accent_color`,
    { headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY')!, Accept: 'application/json' } },
  )
  const [club] = res.ok ? await res.json() : []
  if (!club) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers })

  const asset = (file: string) => `${base}/storage/v1/object/public/club-assets/${club.id}/${file}`
  const icons = club.logo_path
    ? [
        { src: asset('icon-192.png'), sizes: '192x192', type: 'image/png' },
        { src: asset('icon-512.png'), sizes: '512x512', type: 'image/png' },
        { src: asset('maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]
    : [
        { src: `${app}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${app}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      ]

  const manifest = {
    id: `/${slug}`,
    name: club.name,
    short_name: club.name.length > 12 ? club.name.split(' ')[0] : club.name,
    start_url: `${app}/${slug}`,
    scope: `${app}/${slug}`,
    display: 'standalone',
    background_color: '#f3ecdd',
    theme_color: '#f3ecdd',
    icons,
  }
  return new Response(JSON.stringify(manifest), { headers })
})
