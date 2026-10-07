// Creates a student/coach login and links it to a members row, in one atomic
// action. This has to run server-side: creating another person's auth
// account requires the service-role key, which must never reach a browser.
//
// Auth model: called from TatamiHub by a platform admin — a club's own
// coach/owner can no longer add members themselves (that's the whole point:
// a coach who wants a new student added calls/texts us, we add them from the
// Hub). Also accepts club staff via is_club_staff() in case a club ever gets
// this back as self-service. There is no public sign-up anywhere.
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
  password: string
  belt_id?: string
  group_id?: string
  role?: 'student' | 'coach'
  birth_year?: number
  phone?: string
  guardian_consent?: boolean
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401, cors)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Scoped to the caller's own session, so RLS applies exactly as it would
  // from the browser.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user: caller },
  } = await callerClient.auth.getUser()
  if (!caller) {
    return json({ error: 'Not authenticated' }, 401, cors)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, cors)
  }

  if (!body.club_id || !body.email || !body.password) {
    return json({ error: 'club_id, email and password are required' }, 400, cors)
  }

  // Club staff no longer get this from their own site (see 0005's RLS
  // lockdown) — this now runs from TatamiHub, called by a platform admin.
  // is_club_staff is still checked too so the function keeps working if a
  // club ever gets self-service back for this later.
  const [{ data: isPlatformAdmin }, { data: isStaff }] = await Promise.all([
    callerClient.rpc('is_platform_admin'),
    callerClient.rpc('is_club_staff', { p_club_id: body.club_id }),
  ])
  if (!isPlatformAdmin && !isStaff) {
    return json({ error: 'Not authorized for this club' }, 403, cors)
  }

  // Elevated client, only ever used after the staff check above.
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  })
  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'Could not create the account' }, 400, cors)
  }
  const newUserId = created.user.id

  if (body.member_id) {
    const { data: existing } = await adminClient
      .from('members')
      .select('id, user_id, club_id')
      .eq('id', body.member_id)
      .single()

    if (!existing || existing.club_id !== body.club_id) {
      await adminClient.auth.admin.deleteUser(newUserId)
      return json({ error: 'Member not found in this club' }, 404, cors)
    }
    if (existing.user_id) {
      await adminClient.auth.admin.deleteUser(newUserId)
      return json({ error: 'This member already has a login' }, 409, cors)
    }

    const { data: updated, error: updateError } = await adminClient
      .from('members')
      .update({ user_id: newUserId, email: body.email })
      .eq('id', body.member_id)
      .select('id, full_name, role, status, belt_id, email')
      .single()

    if (updateError) {
      await adminClient.auth.admin.deleteUser(newUserId)
      return json({ error: updateError.message }, 500, cors)
    }
    return json({ member: updated }, 200, cors)
  }

  if (!body.full_name) {
    await adminClient.auth.admin.deleteUser(newUserId)
    return json({ error: 'full_name is required for a new member' }, 400, cors)
  }

  const { data: inserted, error: insertError } = await adminClient
    .from('members')
    .insert({
      club_id: body.club_id,
      user_id: newUserId,
      role: body.role ?? 'student',
      full_name: body.full_name,
      email: body.email,
      belt_id: body.belt_id ?? null,
      group_id: body.group_id ?? null,
      status: 'active',
      birth_year: body.birth_year ?? null,
      phone: body.phone ?? null,
      guardian_consent: body.guardian_consent ?? false,
      consent_at: body.guardian_consent ? new Date().toISOString() : null,
    })
    .select('id, full_name, role, status, belt_id, email')
    .single()

  if (insertError) {
    await adminClient.auth.admin.deleteUser(newUserId)
    return json({ error: insertError.message }, 500, cors)
  }

  return json({ member: inserted }, 200, cors)
})
