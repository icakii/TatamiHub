// Lets a Tatami-site customer cancel their own order. Called from the
// public Tatami site (its origin must be in ALLOWED_ORIGINS).
//
// Cancelling a paid order schedules the Paddle subscription to end at the
// close of the current billing period: no refund, service runs until the
// date they already paid for. An unpaid order is simply marked cancelled.
//
// Needs the PADDLE_API_KEY secret (server-side Paddle key, sandbox or live
// to match PADDLE_API_URL).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401, cors)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
  } = await callerClient.auth.getUser()
  if (!user) return json({ error: 'Not signed in' }, 401, cors)

  let orderId: string
  try {
    orderId = (await req.json()).order_id
  } catch {
    return json({ error: 'Invalid body' }, 400, cors)
  }
  if (typeof orderId !== 'string' || !UUID.test(orderId)) {
    return json({ error: 'Invalid order id' }, 400, cors)
  }

  // Read through the caller's own client: RLS only returns their orders,
  // so someone else's order id simply isn't found.
  const { data: order } = await callerClient
    .from('orders')
    .select('id, status, paddle_subscription_id, cancel_at')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return json({ error: 'Order not found' }, 404, cors)
  if (order.status === 'cancelled' || order.cancel_at) {
    return json({ error: 'Already cancelled' }, 409, cors)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  if (!order.paddle_subscription_id) {
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    return json({ cancelled: true, effective: 'now' }, 200, cors)
  }

  const paddleKey = Deno.env.get('PADDLE_API_KEY')
  const paddleUrl = Deno.env.get('PADDLE_API_URL') ?? 'https://sandbox-api.paddle.com'
  if (!paddleKey) return json({ error: 'Payments are not configured' }, 500, cors)

  const res = await fetch(`${paddleUrl}/subscriptions/${order.paddle_subscription_id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${paddleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ effective_from: 'next_billing_period' }),
  })
  if (!res.ok) {
    console.error('Paddle cancel failed', res.status, await res.text())
    return json({ error: 'Could not cancel with the payment provider' }, 502, cors)
  }

  const body = await res.json()
  const effectiveAt: string | undefined = body?.data?.scheduled_change?.effective_at
  const cancelAt = effectiveAt ? effectiveAt.slice(0, 10) : null
  await admin.from('orders').update({ cancel_at: cancelAt }).eq('id', order.id)

  return json({ cancelled: true, effective: cancelAt }, 200, cors)
})
