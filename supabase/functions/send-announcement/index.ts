// Sends the email channel for an already-created announcement. In-app
// delivery (the notifications rows) happens directly from TatamiHub via
// normal RLS-respecting writes — this function only exists because sending
// email needs the Resend API key, a secret that must never reach a browser.
//
// One email per recipient (never a single email exposing every address in
// To/CC), using the club's name as the sender display name, with a contact
// line since there's no unsubscribe flow yet.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

interface Audience {
  all?: boolean
  belt_ids?: string[]
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
  const resendKey = Deno.env.get('RESEND_API_KEY')

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user: caller },
  } = await callerClient.auth.getUser()
  if (!caller) {
    return json({ error: 'Not authenticated' }, 401, cors)
  }

  let body: { announcement_id: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, cors)
  }
  if (!body.announcement_id) {
    return json({ error: 'announcement_id is required' }, 400, cors)
  }

  // RLS on announcements (platform admin or club staff) already gates this
  // read — a caller with no rights just gets no row back.
  const { data: announcement, error: fetchError } = await callerClient
    .from('announcements')
    .select('id, club_id, title, body_bg, audience, club:clubs(name)')
    .eq('id', body.announcement_id)
    .single()

  if (fetchError || !announcement) {
    return json({ error: 'Announcement not found or not authorized' }, 404, cors)
  }

  if (!resendKey) {
    return json({ error: 'Email is not configured yet (missing RESEND_API_KEY secret).' }, 500, cors)
  }

  const audience = announcement.audience as Audience
  let query = callerClient
    .from('members')
    .select('id, email')
    .eq('club_id', announcement.club_id)
    .not('email', 'is', null)

  if (!audience.all && audience.belt_ids && audience.belt_ids.length > 0) {
    query = query.in('belt_id', audience.belt_ids)
  }

  const { data: recipients, error: recipientsError } = await query
  if (recipientsError) {
    return json({ error: recipientsError.message }, 500, cors)
  }

  const clubName = (announcement.club as unknown as { name: string }).name

  const results = await Promise.allSettled(
    (recipients ?? []).map((recipient) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${clubName} <onboarding@resend.dev>`,
          to: recipient.email,
          subject: announcement.title,
          text: `${announcement.body_bg}\n\n---\nВъпроси? Свържете се с треньора си.`,
        }),
      }),
    ),
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length

  await callerClient
    .from('announcements')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', body.announcement_id)

  return json({ sent, total: recipients?.length ?? 0 }, 200, cors)
})
