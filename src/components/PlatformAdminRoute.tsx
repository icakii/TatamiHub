import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import { SealMark } from './ui'

// The Hub sees every club's data, so founders need two-step login (an
// authenticator app such as Google Authenticator). First login after this
// change: set it up (scan a QR code). Every login after: type the 6-digit
// code. The database enforces it too (is_platform_admin needs aal2 once a
// founder has a factor), so this screen isn't the only lock.
export function PlatformAdminRoute({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()

  const state = useQuery({
    queryKey: ['hub-mfa-state', userId],
    queryFn: async () => {
      const { data: isFounder, error } = await supabase.rpc('is_platform_admin_account')
      if (error) throw error
      if (!isFounder) return { step: 'no-access' as const }
      const [{ data: aal }, { data: factors }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ])
      const verified = factors?.totp?.[0]
      if (!verified) return { step: 'enroll' as const }
      if (aal?.currentLevel !== 'aal2') return { step: 'challenge' as const, factorId: verified.id }
      return { step: 'ok' as const }
    },
    enabled: !!userId,
  })

  const done = async () => {
    await supabase.auth.refreshSession()
    await queryClient.invalidateQueries()
  }

  if (state.isLoading || !state.data) {
    return <div className="flex min-h-screen items-center justify-center text-muted">...</div>
  }
  if (state.data.step === 'ok') return <>{children}</>

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="hub-pop w-full max-w-sm rounded-xl border border-line bg-panel p-6 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <SealMark />
          <span className="font-display text-sm font-semibold uppercase tracking-[0.3em] text-straw">Tatami Hub</span>
        </div>
        {state.data.step === 'no-access' && <p className="mt-6 text-sm text-muted">No access. This tool is for Tatami founders only.</p>}
        {state.data.step === 'enroll' && <Enroll onDone={done} />}
        {state.data.step === 'challenge' && <Challenge factorId={state.data.factorId} onDone={done} />}
        <button type="button" onClick={() => signOut()} className="mt-6 w-full text-center text-xs uppercase tracking-wide text-muted hover:text-hanko-text">
          Log out
        </button>
      </div>
    </div>
  )
}

const codeInput =
  'mt-4 min-h-12 w-full rounded-md border border-line bg-ink px-3 text-center font-mono text-2xl tracking-[0.4em] text-text outline-none focus:border-straw'

function CodeForm({ onSubmit, busy, error, label }: { onSubmit: (code: string) => void; busy: boolean; error: string | null; label: string }) {
  const [code, setCode] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit(code)
  }
  return (
    <form onSubmit={submit}>
      <input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className={codeInput}
        aria-label="6-digit code"
      />
      {error && <p className="mt-2 text-sm text-hanko-text">{error}</p>}
      <button type="submit" disabled={busy || code.length !== 6} className="mt-4 min-h-11 w-full rounded-md bg-hanko font-display text-sm uppercase tracking-wide text-text disabled:opacity-50">
        {busy ? '...' : label}
      </button>
    </form>
  )
}

function Challenge({ factorId, onDone }: { factorId: string; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function verify(code: string) {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    setBusy(false)
    if (error) return setError('Wrong code. Try the newest one in the app.')
    await onDone()
  }
  return (
    <>
      <p className="mt-6 font-display text-lg uppercase tracking-wide text-text">Two-step login</p>
      <p className="mt-1 text-sm text-muted">Enter the 6-digit code from your authenticator app.</p>
      <CodeForm onSubmit={verify} busy={busy} error={error} label="Verify" />
    </>
  )
}

function Enroll({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setup = useQuery({
    queryKey: ['hub-mfa-enroll'],
    queryFn: async () => {
      // Drop half-finished setups first, then start a fresh one.
      const { data: list } = await supabase.auth.mfa.listFactors()
      for (const f of list?.all ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Tatami Hub ${new Date().toISOString().slice(0, 10)}` })
      if (error) throw error
      return data
    },
    staleTime: Infinity,
    gcTime: 0,
  })

  async function verify(code: string) {
    if (!setup.data) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.data.id, code })
    setBusy(false)
    if (error) return setError('That code did not match. Wait for a new one and try again.')
    await onDone()
  }

  return (
    <>
      <p className="mt-6 font-display text-lg uppercase tracking-wide text-text">Set up two-step login</p>
      <p className="mt-1 text-sm text-muted">
        The Hub holds every club's data, so it needs a second step. Install Google Authenticator (or Microsoft Authenticator, 1Password...) on your phone, scan this code, then enter the 6 digits it shows.
      </p>
      {setup.isLoading && <p className="mt-4 text-sm text-muted">...</p>}
      {setup.error && <p className="mt-4 text-sm text-hanko-text">{(setup.error as Error).message}</p>}
      {setup.data && (
        <>
          <div className="mx-auto mt-4 w-48 rounded-lg bg-white p-2">
            <img src={setup.data.totp.qr_code} alt="QR code for the authenticator app" className="h-full w-full" />
          </div>
          <details className="mt-3 text-xs text-muted">
            <summary className="cursor-pointer">Can't scan? Enter the key by hand</summary>
            <p className="mt-2 break-all rounded bg-ink p-2 font-mono text-text">{setup.data.totp.secret}</p>
          </details>
          <CodeForm onSubmit={verify} busy={busy} error={error} label="Turn on" />
        </>
      )}
    </>
  )
}
