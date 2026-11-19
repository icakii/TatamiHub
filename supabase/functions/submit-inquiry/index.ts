// A request ("Поискай оферта") from the public Tatami site, no account needed.
// Since 2026-11-17 every order is a request and clubs pay us by bank or cash,
// so signing up first was just friction. The browser calls this with the
// anon key; the row is written here with the service role, after validation
// and a spam guard (a hidden honeypot field plus per-email and global limits).
// A signed-in caller still gets the order on their account.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const PLANS = ['site', 'club', 'club_pro', 'store', 'custom']
const DOMAINS = ['subdomain', 'own', 'new']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

// The optional club setup (halls, groups, coaches...): only known fields,
// short strings, capped list sizes.
type Row = Record<string, unknown>
const rows = (v: unknown, max: number, fields: Record<string, number>) =>
  (Array.isArray(v) ? v : [])
    .slice(0, max)
    .map((r: Row) => Object.fromEntries(Object.entries(fields).map(([k, len]) => [k, str(r?.[k], len)])))
    .filter((r) => Object.values(r).some(Boolean))

function cleanSetup(v: unknown) {
  if (!v || typeof v !== 'object') return null
  const s = v as Row
  const extras = (s.extras ?? {}) as Row
  const setup = {
    halls: rows(s.halls, 10, { name: 80, address: 160 }),
    groups: rows(s.groups, 30, { name: 80, ages: 60, hall: 80, schedule: 200, fee: 20 }),
    coaches: rows(s.coaches, 15, { name: 80, phone: 40, email: 120, role: 10 }),
    belts: ['kyu_dan', 'colors', 'other'].includes(String(s.belts)) ? String(s.belts) : null,
    extras: { grades: extras.grades === true, qr: extras.qr === true, store: extras.store === true },
    accent: /^#[0-9a-fA-F]{6}$/.test(String(s.accent)) ? String(s.accent) : null,
  }
  return setup.halls.length || setup.groups.length || setup.coaches.length || setup.belts || setup.accent ? setup : null
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, cors)
  }

  // Bots fill every field; people never see this one. Pretend it worked.
  if (str(body.website, 200)) return json({ ok: true }, 200, cors)

  const email = str(body.email, 200)?.toLowerCase()
  const contact_name = str(body.contact_name, 120)
  const club_name = str(body.club_name, 120)
  const notes = str(body.notes, 2000)
  const plan = String(body.plan ?? '')
  const domain_option = String(body.domain_option ?? 'subdomain')
  const student_count = Number.isFinite(Number(body.student_count)) && body.student_count !== null && body.student_count !== ''
    ? Math.round(Number(body.student_count))
    : null
  if (!email || !EMAIL.test(email)) return json({ error: 'email' }, 400, cors)
  if (!contact_name || contact_name.length < 2 || !club_name || club_name.length < 2) return json({ error: 'name' }, 400, cors)
  if (!notes || notes.length < 10) return json({ error: 'notes' }, 400, cors)
  if (!PLANS.includes(plan) || !DOMAINS.includes(domain_option)) return json({ error: 'plan' }, 400, cors)
  if (student_count !== null && (student_count < 0 || student_count > 5000)) return json({ error: 'students' }, 400, cors)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Signed in? Keep the request on their account page.
  let userId: string | null = null
  const authHeader = req.headers.get('Authorization')
  if (authHeader) {
    const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    userId = (await caller.auth.getUser()).data.user?.id ?? null
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const [{ count: mine }, { count: all }] = await Promise.all([
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since),
    admin.from('orders').select('id', { count: 'exact', head: true }).is('user_id', null).gte('created_at', since),
  ])
  if ((mine ?? 0) >= 3 || (all ?? 0) >= 50) {
    return json({ error: 'Too many requests. Please write to us by email.' }, 429, cors)
  }

  const { error } = await admin.from('orders').insert({
    user_id: userId,
    contact_name,
    email,
    phone: str(body.phone, 40),
    club_name,
    city: str(body.city, 80),
    student_count,
    domain_option,
    domain: domain_option === 'subdomain' ? null : str(body.domain, 120)?.toLowerCase() ?? null,
    notes,
    plan,
    setup: cleanSetup(body.setup),
    status: 'inquiry',
    terms_accepted_at: new Date().toISOString(),
  })
  if (error) return json({ error: error.message }, 500, cors)
  return json({ ok: true }, 200, cors)
})
