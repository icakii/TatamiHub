// Emails a student (or their parent) who is 3+ months behind on fees,
// asking whether they are still training. Called by club staff from the
// payments page of the club's admin panel.
//
// Guard rails: caller must be staff of the member's club, the member must
// really be 3+ months behind, and each member gets at most one reminder per
// 14 days (members.last_reminder_at), so a click-happy coach or a stolen
// session can't burn the email quota.
//
// Sends through Brevo's transactional API (BREVO_API_KEY secret), from
// noreply@tatamistudio.net (domain verified in Brevo).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BEHIND_DAYS = 90
const THROTTLE_DAYS = 14

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401, cors)

  const url = Deno.env.get('SUPABASE_URL')!
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json({ error: 'Not signed in' }, 401, cors)

  let memberId: string
  try {
    memberId = (await req.json()).member_id
  } catch {
    return json({ error: 'Invalid body' }, 400, cors)
  }
  if (typeof memberId !== 'string' || !UUID.test(memberId)) return json({ error: 'Invalid member' }, 400, cors)

  const { data: member } = await admin
    .from('members')
    .select('id, club_id, full_name, email, guardian_email, guardian_first_name, last_reminder_at, joined_at, role')
    .eq('id', memberId)
    .maybeSingle()
  if (!member || member.role !== 'student') return json({ error: 'Not found' }, 404, cors)

  const { data: isStaff } = await caller.rpc('is_club_staff', { p_club_id: member.club_id })
  if (!isStaff) return json({ error: 'Not allowed' }, 403, cors)

  const to = member.guardian_email || member.email
  if (!to) return json({ error: 'no_email' }, 422, cors)

  if (member.last_reminder_at && Date.now() - new Date(member.last_reminder_at).getTime() < THROTTLE_DAYS * 86_400_000) {
    return json({ error: 'recently_sent', last: member.last_reminder_at }, 429, cors)
  }

  // Really 3+ months behind? Latest paid period end, or the join date if
  // they never paid.
  const { data: paid } = await admin
    .from('payments')
    .select('period_end')
    .eq('member_id', member.id)
    .eq('status', 'paid')
    .order('period_end', { ascending: false })
    .limit(1)
  const since = paid?.[0]?.period_end ?? member.joined_at
  const behindDays = Math.floor((Date.now() - new Date(`${since}T00:00:00Z`).getTime()) / 86_400_000)
  if (behindDays < BEHIND_DAYS) return json({ error: 'not_behind' }, 409, cors)

  const { data: club } = await admin.from('clubs').select('name').eq('id', member.club_id).single()
  const apiKey = Deno.env.get('BREVO_API_KEY')
  if (!apiKey) return json({ error: 'email_not_configured' }, 503, cors)

  const name = escapeHtml(member.guardian_first_name || member.full_name.split(' ')[0])
  const student = escapeHtml(member.full_name)
  const clubName = escapeHtml(club?.name ?? 'клуба')
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f1b16">
  <h2 style="margin:0 0 12px">Здравейте, ${name}!</h2>
  <p>От ${clubName} забелязахме, че таксата на <b>${student}</b> не е платена от около ${Math.round(behindDays / 30)} месеца.</p>
  <p>Ако все още тренирате, просто платете при следващата тренировка. Ако сте спрели, ще се радваме да ни пишете с отговор на този имейл, за да обновим списъка.</p>
  <p>Благодарим!<br>${clubName}</p>
  <p style="color:#8a8275;font-size:12px;margin-top:24px">Изпратено чрез Tatami Studio · tatamistudio.net</p>
</div>`

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: club?.name ?? 'Tatami Studio', email: 'noreply@tatamistudio.net' },
      to: [{ email: to }],
      subject: `${club?.name ?? 'Клуб'}: такса за ${member.full_name}`,
      htmlContent: html,
    }),
  })
  if (!res.ok) {
    console.error('Brevo error', res.status, await res.text())
    return json({ error: 'send_failed' }, 502, cors)
  }

  await admin.from('members').update({ last_reminder_at: new Date().toISOString() }).eq('id', member.id)
  return json({ sent: true, to }, 200, cors)
})
