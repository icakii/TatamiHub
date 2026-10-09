// Receives Paddle webhook events and keeps club_billing in sync so the
// Suspend/Reactivate mechanism in Billing.tsx reflects real payment state
// instead of requiring a manual "Mark paid" click every time.
//
// Public endpoint — Paddle (not a logged-in user) calls this, authenticated
// by HMAC signature rather than a Supabase JWT. Deployed with
// verify_jwt = false (see supabase/config.toml) so Supabase's gateway
// doesn't reject it for having no Authorization header.
//
// Signature verification is done by hand with Deno's native Web Crypto
// instead of @paddle/paddle-node-sdk's `webhooks.unmarshal()` — that call
// needs a full Paddle client (and an API key) just to do local HMAC
// comparison, and the Node SDK's behavior under Deno's npm compat layer
// isn't something to bet a security check on when the raw algorithm
// (HMAC-SHA256 over "ts:body") is this simple to implement directly.
import { createClient } from 'npm:@supabase/supabase-js@2'

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function verifySignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(';').map((p) => p.split('=') as [string, string]),
  )
  const ts = parts.ts
  const h1 = parts.h1
  if (!ts || !h1) return false

  // Basic replay protection — Paddle regenerates ts on every retry, so a
  // fresh delivery (including retries) should always be recent.
  const ageSeconds = Date.now() / 1000 - Number(ts)
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300 || ageSeconds < -60) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signatureBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${ts}:${rawBody}`),
  )
  const computed = Array.from(new Uint8Array(signatureBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (computed.length !== h1.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ h1.charCodeAt(i)
  return diff === 0
}

interface PaddleEvent {
  event_type: string
  data: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const signatureHeader = req.headers.get('paddle-signature') ?? ''
  const rawBody = await req.text()
  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET') ?? ''

  if (!signatureHeader || !rawBody || !secret) {
    return json({ error: 'Missing signature, body, or secret' }, 400)
  }

  try {
    const verified = await verifySignature(rawBody, signatureHeader, secret)
    if (!verified) {
      // Tampered request, wrong/rotated secret, or expired timestamp all
      // look the same here — any non-2xx gets retried on Paddle's budget,
      // so a rotated secret recovers automatically once redeployed.
      return json({ error: 'Signature verification failed' }, 401)
    }

    const event = JSON.parse(rawBody) as PaddleEvent

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(supabaseUrl, serviceRoleKey)

    await processEvent(db, event)

    return json({ received: true }, 200)
  } catch (e) {
    console.error('Paddle webhook error:', e)
    return json({ error: 'Internal error' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function processEvent(db: any, event: PaddleEvent) {
  switch (event.event_type) {
    case 'customer.created':
    case 'customer.updated':
      return handleCustomer(db, event.data)
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.canceled':
      return handleSubscription(db, event.data)
    default:
      // Subscribed to an event we don't act on yet — no-op, not an error.
      return
  }
}

// deno-lint-ignore no-explicit-any
async function handleCustomer(db: any, customer: Record<string, unknown>) {
  const email = customer.email as string | undefined
  const customerId = customer.id as string | undefined
  if (!email || !customerId) return

  // Bridge by email: the owner who paid matches the members row we already
  // have (pre-filled at checkout in KimeClub's Subscription tab).
  const { data: owner } = await db
    .from('members')
    .select('club_id')
    .eq('role', 'owner')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()
  if (!owner) return

  await db.from('club_billing').update({ paddle_customer_id: customerId }).eq('club_id', owner.club_id)
}

// deno-lint-ignore no-explicit-any
async function handleSubscription(db: any, sub: Record<string, unknown>) {
  const customerId = sub.customer_id as string | undefined
  const subscriptionId = sub.id as string | undefined
  const status = sub.status as string | undefined
  if (!customerId || !subscriptionId) return

  const { data: billing } = await db
    .from('club_billing')
    .select('club_id')
    .eq('paddle_customer_id', customerId)
    .maybeSingle()
  if (!billing) return

  const period = sub.current_billing_period as { ends_at?: string } | null
  const paidUntil = period?.ends_at ? period.ends_at.slice(0, 10) : null
  const isActive = status === 'active' || status === 'trialing'

  await db
    .from('club_billing')
    .update({
      paddle_subscription_id: subscriptionId,
      ...(paidUntil ? { paid_until: paidUntil } : {}),
    })
    .eq('club_id', billing.club_id)

  if (isActive) {
    // Payment succeeded — automatically bring a suspended club back online.
    // Deliberately one-directional: a cancellation/failure here does NOT
    // auto-suspend, since that's a founder judgment call made from Billing.
    await db.from('clubs').update({ status: 'live' }).eq('id', billing.club_id).eq('status', 'paused')
  }
}
