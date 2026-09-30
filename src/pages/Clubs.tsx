import { Link } from 'react-router-dom'
import { useClubs } from '../hooks/useClubs'

export function Clubs() {
  const { data: clubs, isLoading } = useClubs()

  return (
    <div className="px-6 py-6">
      <h1 className="font-display text-xl uppercase tracking-wide text-text">Clubs</h1>

      <div className="mt-4 divide-y divide-line rounded-lg border border-line bg-panel">
        {isLoading && <p className="p-6 text-center text-muted">...</p>}
        {clubs?.map((club) => (
          <Link
            key={club.id}
            to={`/clubs/${club.id}`}
            className="flex items-center justify-between p-4 hover:bg-raised"
          >
            <span className="text-text">{club.name}</span>
            <span className="text-xs uppercase tracking-wide text-muted">{club.status}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
