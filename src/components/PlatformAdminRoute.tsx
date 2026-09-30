import type { ReactNode } from 'react'
import { useIsPlatformAdmin } from '../hooks/useIsPlatformAdmin'

export function PlatformAdminRoute({ children }: { children: ReactNode }) {
  const { data: isAdmin, isLoading } = useIsPlatformAdmin()

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">...</div>
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-muted">
        No access. This tool is for Tatami platform admins only.
      </div>
    )
  }

  return <>{children}</>
}
