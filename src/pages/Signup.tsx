import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Signup() {
  const { session, signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  if (session) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signUp(email, password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setCreated(true)
  }

  if (created) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="font-display text-lg uppercase tracking-[3px] text-straw">
            Account created
          </h1>
          <p className="mt-4 text-sm text-muted">
            This only creates your login — it doesn't give you access to the Hub yet. A platform
            admin needs to add your user id to the <code className="text-text">platform_admins</code>{' '}
            table in Supabase (SQL editor):
          </p>
          <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-ink p-3 text-left text-xs text-text">
            insert into platform_admins (user_id) values ('YOUR-USER-ID');
          </pre>
          <p className="mt-4 text-sm text-muted">
            Find your user id under Authentication {'->'} Users in the Supabase dashboard, by your
            email.
          </p>
          <p className="mt-4 text-sm text-muted">
            If this project requires email confirmation, you'll also need to confirm your address
            (check your inbox for a link) before you can log in — or a platform admin can confirm
            it directly in the SQL editor:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-ink p-3 text-left text-xs text-text">
            update auth.users set email_confirmed_at = now() where email = 'YOUR-EMAIL';
          </pre>
          <Link to="/login" className="mt-6 inline-block text-sm text-hanko-text hover:underline">
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-lg uppercase tracking-[3px] text-straw">
          Create a Hub account
        </h1>
        <p className="mt-2 text-center text-xs text-muted">
          This creates a login only. Platform-admin access is granted separately by someone who
          already has it.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-text outline-none focus:border-hanko-text"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-panel px-3 text-text outline-none focus:border-hanko-text"
            />
          </div>

          {error && <p className="text-sm text-hanko-text">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 w-full rounded-md bg-hanko font-display text-sm uppercase tracking-wide text-text disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create account'}
          </button>
        </form>

        <Link
          to="/login"
          className="mt-6 block text-center text-sm text-muted hover:text-hanko-text"
        >
          Already have an account? Log in
        </Link>
      </div>
    </div>
  )
}
