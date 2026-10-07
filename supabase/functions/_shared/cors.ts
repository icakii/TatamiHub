// Locks CORS to known origins instead of '*'. Both functions here are only
// ever called from TatamiHub itself (never a club site), so the allow-list
// only needs TatamiHub's own URL(s) plus local dev ports.
//
// Add production origins via the ALLOWED_ORIGINS function secret
// (comma-separated, no trailing slashes) instead of editing this file.
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:5174']

function allowedOrigins(): string[] {
  const fromEnv = Deno.env.get('ALLOWED_ORIGINS')
  if (!fromEnv) return DEFAULT_ORIGINS
  return fromEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = allowedOrigins()
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
}
