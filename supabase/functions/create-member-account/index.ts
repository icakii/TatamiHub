// Creates a login and links it to a members row, in one action. This has to
// run server-side: creating another person's auth account requires the
// service-role key, which must never reach a browser.
//
// Who may call it: platform admins (TatamiHub) and, since 2026-11-15, a
// club's own owner/coach for students of their club. Staff can only create
// students, never coaches.
//
// Families: if the email already belongs to a login that has a child in this
// same club, the new child is linked to that existing login (one parent
// account, several children) and the password is ignored. An email used by
// anyone else is refused, so a coach can't attach a stranger's account.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

interface RequestBody {
  club_id: string
  member_id?: string
  full_name?: string
  email: string
  password?: string
  belt_id?: string
  group_id?: string
  role?: 'student' | 'coach'
  birth_year?: number
  phone?: string
  egn?: string
  guardian_first_name?: string
  guardian_last_name?: string
  guardian_phone?: string
  guardian_consent?: boolean
  monthly_fee_cents?: number
}

const EGN = /^[0-9]{10}$/

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401, cors)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Scoped to the caller's own session, so RLS applies exactly as it would
  // from the browser.
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user: caller },
  } = await callerClient.auth.getUser()
  if (!caller) return json({ error: 'Not authenticated' }, 401, cors)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, cors)
  }
  const email = body.email?.trim().toLowerCase()
  if (!body.club_id || !email) return json({ error: 'club_id and email are required' }, 400, cors)
  if (body.egn && !EGN.test(body.egn)) return json({ error: 'ЕГН must be 10 digits' }, 400, cors)

  const [{ data: isPlatformAdmin }, { data: isStaff }] = await Promise.all([
    callerClient.rpc('is_platform_admin'),
    callerClient.rpc('is_club_staff', { p_club_id: body.club_id }),
  ])
  if (!isPlatformAdmin && !isStaff) return json({ error: 'Not authorized for this club' }, 403, cors)
  // Coaches create students only.
  const role = isPlatformAdmin ? (body.role ?? 'student') : 'student'

  // Elevated client, only ever used after the checks above.
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // An existing login: only reusable if it's a parent who already has a child here.
  const { data: existingUserId } = await admin.rpc('auth_user_id_by_email', { p_email: email })
  let userId: string
  let createdNow = false
  if (existingUserId) {
    const { data: sibling } = await admin
      .from('members')
      .select('id')
      .eq('club_id', body.club_id)
      .eq('user_id', existingUserId)
      .limit(1)
    if (!sibling?.length || role !== 'student') {
      return json({ error: 'Този имейл вече се използва от друг профил.' }, 409, cors)
    }
    userId = existingUserId as string
  } else {
    if (!body.password || body.password.length < 8) {
      return json({ error: 'Паролата трябва да е поне 8 символа.' }, 400, cors)
    }
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
    })
    if (createError || !created.user) {
      return json({ error: createError?.message ?? 'Could not create the account' }, 400, cors)
    }
    userId = created.user.id
    createdNow = true
  }
  const undo = async () => {
    if (createdNow) await admin.auth.admin.deleteUser(userId)
  }

  if (body.member_id) {
    const { data: existing } = await admin.from('members').select('id, user_id, club_id, role').eq('id', body.member_id).single()
    if (!existing || existing.club_id !== body.club_id) {
      await undo()
      return json({ error: 'Member not found in this club' }, 404, cors)
    }
    if (existing.user_id) {
      await undo()
      return json({ error: 'This member already has a login' }, 409, cors)
    }
    if (!isPlatformAdmin && existing.role !== 'student') {
      await undo()
      return json({ error: 'Not authorized for this member' }, 403, cors)
    }
    const { data: updated, error: updateError } = await admin
      .from('members')
      .update({ user_id: userId, email })
      .eq('id', body.member_id)
      .select('id, full_name, role, status, belt_id, email')
      .single()
    if (updateError) {
      await undo()
      return json({ error: updateError.message }, 500, cors)
    }
    return json({ member: updated, linked_existing: !createdNow }, 200, cors)
  }

  if (!body.full_name?.trim()) {
    await undo()
    return json({ error: 'full_name is required for a new member' }, 400, cors)
  }

  const { data: inserted, error: insertError } = await admin
    .from('members')
    .insert({
      club_id: body.club_id,
      user_id: userId,
      role,
      full_name: body.full_name.trim(),
      email,
      belt_id: body.belt_id ?? null,
      group_id: body.group_id ?? null,
      monthly_fee_cents: body.monthly_fee_cents ?? null,
      status: 'active',
      birth_year: body.birth_year ?? null,
      phone: body.phone ?? null,
      egn: body.egn ?? null,
      guardian_first_name: body.guardian_first_name ?? null,
      guardian_last_name: body.guardian_last_name ?? null,
      guardian_phone: body.guardian_phone ?? null,
      guardian_consent: body.guardian_consent ?? false,
      consent_at: body.guardian_consent ? new Date().toISOString() : null,
    })
    .select('id, full_name, role, status, belt_id, email')
    .single()
  if (insertError) {
    await undo()
    return json({ error: insertError.message }, 500, cors)
  }
  return json({ member: inserted, linked_existing: !createdNow }, 200, cors)
})
