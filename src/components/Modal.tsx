import { useEffect, type ReactNode } from 'react'

export function Modal({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string
  closeLabel?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/80 px-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
        className="hub-pop max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-line bg-panel p-6 shadow-2xl"
      >
        <h2 id="modal-title" className="font-display text-lg uppercase tracking-wide text-text">
          {title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
        {closeLabel && (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 min-h-11 w-full rounded-md bg-hanko px-4 font-display text-sm uppercase tracking-wide text-text"
          >
            {closeLabel}
          </button>
        )}
      </div>
    </div>
  )
}
