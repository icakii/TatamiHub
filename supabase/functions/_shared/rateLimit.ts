// Fixed-window rate limit backed by the rate_limits table (service role).
// Returns false when the caller is over the limit. Fails open if the check
// itself errors, so a database hiccup doesn't block real users.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown'
}

export async function allow(admin: SupabaseClient, key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin.rpc('hit_rate_limit', { p_key: key.slice(0, 200), p_max: max, p_window_seconds: windowSeconds })
  if (error) {
    console.error('rate limit check failed', error.message)
    return true
  }
  return data === true
}
