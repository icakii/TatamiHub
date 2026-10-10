import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../Modal'
import { useCreateClub } from '../../hooks/useClubs'

// Latin + Cyrillic -> URL slug ("Кимé Карате" -> "kime-karate").
const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k',
  л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h',
  ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: '', ю: 'yu', я: 'ya',
}
function slugify(name: string): string {
  return name
    .toLowerCase()
    .split('')
    .map((ch) => CYR[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const inputClass =
  'mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-text outline-none focus:border-hanko-text'

export function CreateClubModal({
  onClose,
  initial,
  onCreated,
}: {
  onClose: () => void
  // Prefill when a club is created from a Tatami-site order.
  initial?: { name?: string; hostname?: string; monthlyEur?: number }
  onCreated?: (clubId: string) => Promise<void> | void
}) {
  const createClub = useCreateClub()
  const navigate = useNavigate()
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(() => slugify(initial?.name ?? ''))
  const [slugTouched, setSlugTouched] = useState(false)
  const [locale, setLocale] = useState<'bg' | 'en'>('bg')
  const [hostname, setHostname] = useState(initial?.hostname ?? '')
  const [price, setPrice] = useState(String(initial?.monthlyEur ?? 99))
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const club = await createClub.mutateAsync({
        name: name.trim(),
        slug: slug.trim(),
        defaultLocale: locale,
        hostname: hostname.trim() || undefined,
        monthlyPriceCents: Math.round(Number(price) * 100),
      })
      await onCreated?.(club.id)
      onClose()
      navigate(`/clubs/${club.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <Modal title="New club" onClose={onClose}>
      <p>
        Creates the club as a draft with the standard 7-belt ladder and a billing row. It goes live
        once you flip it on from Billing.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-left">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Club name</span>
          <input
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!slugTouched) setSlug(slugify(e.target.value))
            }}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Slug (URL id)</span>
          <input
            required
            pattern="[a-z0-9-]+"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value)
            }}
            className={`${inputClass} font-mono`}
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted">Domain (optional)</span>
          <input
            placeholder="karate-club.bg"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            className={`${inputClass} font-mono`}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-muted">Language</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'bg' | 'en')}
              className={inputClass}
            >
              <option value="bg">Български</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-muted">Monthly (EUR)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        {error && <p className="text-sm text-hanko-text">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-md border border-line font-display text-sm uppercase tracking-wide text-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createClub.isPending}
            className="min-h-11 flex-1 rounded-md bg-hanko font-display text-sm uppercase tracking-wide text-text disabled:opacity-60"
          >
            {createClub.isPending ? 'Creating...' : 'Create club'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
