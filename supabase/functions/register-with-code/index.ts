// Self-registration with a club's join code (2026-11-19). A parent (or a
// student of 14+) opens the app, taps "Регистрация", enters the club code
// and fills in their own details. No coach approval; the code is the gate.
//
// Two modes:
//  - new account: code + account (email, password, phone) + students
//  - add a child: a signed-in user + club_id + students (from Profile)
//
// Rules: ЕГН required, valid and unique per club; phone required; password
// 8+; the user must tick the terms (stored in legal_acceptances).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const LEGAL_VERSION = '2026-11-19'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[0-9 ()-]{6,20}$/

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Bulgarian ЕГН: date of birth in the first 6 digits (month +20 for the
// 1800s, +40 for the 2000s) and a weighted checksum at the end.
function egnBirth(egn: string): Date | null {
  if (!/^[0-9]{10}$/.test(egn)) return null
  const w = [2, 4, 8, 5, 10, 9, 7, 3, 6]
  const sum = w.reduce((s, x, i) => s + x * Number(egn[i]), 0)
  if ((sum % 11) % 10 !== Number(egn[9])) return null
  let year = 1900 + Number(egn.slice(0, 2))
  let month = Number(egn.slice(2, 4))
  if (month > 40) {
    month -= 40
    year += 100
  } else if (month > 20) {
    month -= 20
    year -= 100
  }
  const day = Number(egn.slice(4, 6))
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day || d > new Date()) return null
  return d
}

interface StudentIn {
  full_name: string
  egn: string
  phone?: string
}

interface Body {
  check?: boolean
  code?: string
  club_id?: string
  role?: 'parent' | 'student'
  account?: { email: string; password: string; full_name: string; phone: string }
  students: StudentIn[]
  accepted: boolean
  photo_consent?: boolean
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, cors)
  }
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Step 1 in the app: is this code right? Shows the club's name and logo.
  if (body.check) {
    const code = str(body.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '')
    const { data } = await admin.from('club_join_codes').select('club:clubs(id, slug, name, logo_path, accent_color, status, member_terms)').eq('code', code).maybeSingle()
    const club = data?.club as { status: string } | null | undefined
    if (!club || club.status === 'paused') return json({ error: 'Грешен код на клуба.' }, 404, cors)
    return json({ club }, 200, cors)
  }

  if (!body.accepted) return json({ error: 'Трябва да приемеш условията.' }, 400, cors)

  // Signed in already? Then this adds children to that login.
  let userId: string | null = null
  const authHeader = req.headers.get('Authorization')
  if (authHeader) {
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    userId = (await caller.auth.getUser()).data.user?.id ?? null
  }

  // Which club.
  let clubId: string | null = null
  if (body.code) {
    const code = str(body.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '')
    const { data } = await admin.from('club_join_codes').select('club_id').eq('code', code).maybeSingle()
    clubId = data?.club_id ?? null
    if (!clubId) return json({ error: 'Грешен код на клуба.' }, 404, cors)
  } else if (userId && body.club_id) {
    const { data } = await admin.from('members').select('id').eq('club_id', body.club_id).eq('user_id', userId).limit(1)
    if (!data?.length) return json({ error: 'Not a member of this club' }, 403, cors)
    clubId = body.club_id
  } else {
    return json({ error: 'Липсва код на клуба.' }, 400, cors)
  }
  const { data: club } = await admin.from('clubs').select('id, slug, name, status, member_terms_updated_at').eq('id', clubId).single()
  if (!club || club.status === 'paused') return json({ error: 'Клубът не приема регистрации в момента.' }, 403, cors)

  // Students.
  const students = (Array.isArray(body.students) ? body.students : []).slice(0, 6).map((s) => ({
    full_name: str(s.full_name, 120),
    egn: str(s.egn, 10),
    phone: str(s.phone, 40),
  }))
  if (students.length === 0) return json({ error: 'Добави поне един ученик.' }, 400, cors)
  const births: Date[] = []
  for (const s of students) {
    if (s.full_name.length < 3 || !s.full_name.includes(' ')) return json({ error: `Напиши име и фамилия: ${s.full_name || '?'}` }, 400, cors)
    const born = egnBirth(s.egn)
    if (!born) return json({ error: `Невалидно ЕГН: ${s.full_name}` }, 400, cors)
    births.push(born)
  }
  if (new Set(students.map((s) => s.egn)).size !== students.length) return json({ error: 'Едно и също ЕГН е въведено два пъти.' }, 400, cors)
  const { data: taken } = await admin.from('members').select('egn').eq('club_id', clubId).in('egn', students.map((s) => s.egn))
  if (taken?.length) return json({ error: 'Ученик с това ЕГН вече е регистриран в клуба. Ако е твоето дете, влез в своя профил.' }, 409, cors)

  // Spam guard: at most 40 new students per club per hour.
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await admin.from('members').select('id', { count: 'exact', head: true }).eq('club_id', clubId).gte('created_at', since)
  if ((count ?? 0) + students.length > 40) return json({ error: 'Твърде много регистрации. Опитай пак след малко.' }, 429, cors)

  // The account (new mode).
  const role = body.role === 'student' ? 'student' : 'parent'
  let holder = { full_name: '', phone: '', email: '' }
  let createdNow = false
  if (!userId) {
    const a = body.account
    const email = str(a?.email, 200).toLowerCase()
    const password = typeof a?.password === 'string' ? a.password : ''
    holder = { full_name: str(a?.full_name, 120), phone: str(a?.phone, 40), email }
    if (!EMAIL.test(email)) return json({ error: 'Невалиден имейл.' }, 400, cors)
    if (password.length < 8) return json({ error: 'Паролата трябва да е поне 8 символа.' }, 400, cors)
    if (!PHONE.test(holder.phone)) return json({ error: 'Невалиден телефон.' }, 400, cors)
    if (holder.full_name.length < 3) return json({ error: 'Напиши своето име и фамилия.' }, 400, cors)
    const { data: existing } = await admin.rpc('auth_user_id_by_email', { p_email: email })
    if (existing) return json({ error: 'Този имейл вече има профил. Влез и добави детето от Профил.' }, 409, cors)
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: holder.full_name, phone: holder.phone },
    })
    if (error || !created.user) return json({ error: error?.message ?? 'Could not create the account' }, 400, cors)
    userId = created.user.id
    createdNow = true
  } else {
    const { data: u } = await admin.auth.admin.getUserById(userId)
    holder = {
      full_name: (u.user?.user_metadata?.full_name as string) ?? '',
      phone: (u.user?.user_metadata?.phone as string) ?? '',
      email: u.user?.email ?? '',
    }
  }

  const [first, ...rest] = holder.full_name.split(/\s+/)
  const guardian = role === 'parent'
    ? { guardian_first_name: first || null, guardian_last_name: rest.join(' ') || null, guardian_phone: holder.phone || null, guardian_email: holder.email || null, guardian_consent: true, consent_at: new Date().toISOString() }
    : {}

  const { data: inserted, error: insertError } = await admin
    .from('members')
    .insert(
      students.map((s, i) => ({
        club_id: clubId,
        user_id: userId,
        role: 'student',
        status: 'active',
        full_name: s.full_name,
        egn: s.egn,
        birth_year: births[i].getUTCFullYear(),
        phone: role === 'student' ? holder.phone || s.phone || null : s.phone || null,
        email: role === 'student' ? holder.email || null : null,
        login_name: holder.email || null,
        ...guardian,
      })),
    )
    .select('id, full_name')
  if (insertError) {
    if (createdNow) await admin.auth.admin.deleteUser(userId)
    const dup = insertError.code === '23505'
    return json({ error: dup ? 'Ученик с това ЕГН вече е регистриран в клуба.' : insertError.message }, dup ? 409 : 500, cors)
  }

  await admin
    .from('legal_acceptances')
    .upsert(
      {
        user_id: userId,
        club_id: clubId,
        version: LEGAL_VERSION,
        as_guardian: role === 'parent',
        // Which version of the club's rules was accepted (null = the standard text).
        club_terms_at: club.member_terms_updated_at ?? null,
        photo_consent: body.photo_consent === true,
      },
      { onConflict: 'user_id,club_id,version' },
    )

  return json({ ok: true, club: { slug: club.slug, name: club.name }, students: inserted }, 200, cors)
})
