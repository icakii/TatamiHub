type Row = Record<string, string | null>

export interface OrderSetupData {
  halls?: Row[]
  groups?: Row[]
  coaches?: Row[]
  belts?: 'kyu_dan' | 'colors' | 'other' | null
  extras?: { grades?: boolean; qr?: boolean; store?: boolean }
  accent?: string | null
}

const BELTS = { kyu_dan: 'Kyu / dan', colors: 'Colours only', other: 'Other' }

function Table({ title, cols, rows }: { title: string; cols: [string, string][]; rows?: Row[] }) {
  if (!rows?.length) return null
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted">{title}</p>
      <div className="mt-1 overflow-x-auto rounded-md border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel text-left text-[11px] uppercase tracking-wide text-muted">
              {cols.map(([, label]) => (
                <th key={label} className="px-3 py-2 font-normal">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                {cols.map(([k]) => (
                  <td key={k} className="px-3 py-2 text-text">{r[k] ?? '-'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// The club setup sent with a request: what we need to create the club.
export function OrderSetup({ setup }: { setup: OrderSetupData }) {
  const extras = Object.entries(setup.extras ?? {}).filter(([, on]) => on).map(([k]) => ({ grades: 'Grades', qr: 'QR check-in', store: 'Store' })[k as 'grades'])
  return (
    <div className="mt-4 space-y-4 rounded-md border border-straw/20 bg-ink/40 p-4">
      <p className="font-display text-sm uppercase tracking-wide text-straw">Club setup</p>
      <Table title="Halls" cols={[['name', 'Hall'], ['address', 'Address']]} rows={setup.halls} />
      <Table title="Groups" cols={[['name', 'Group'], ['ages', 'Age / level'], ['hall', 'Hall'], ['schedule', 'When'], ['fee', 'Fee €']]} rows={setup.groups} />
      <Table title="Coaches" cols={[['name', 'Name'], ['role', 'Role'], ['phone', 'Phone'], ['email', 'Email']]} rows={setup.coaches} />
      <div className="flex flex-wrap gap-6 text-sm">
        {setup.belts && (
          <p>
            <span className="text-muted">Belts: </span>
            <span className="text-text">{BELTS[setup.belts]}</span>
          </p>
        )}
        {setup.accent && (
          <p className="flex items-center gap-2">
            <span className="text-muted">Colour:</span>
            <span className="h-4 w-4 rounded-full ring-1 ring-line" style={{ background: setup.accent }} />
            <span className="font-mono text-xs text-text">{setup.accent}</span>
          </p>
        )}
        <p>
          <span className="text-muted">Extras: </span>
          <span className="text-text">{extras.length ? extras.join(', ') : 'none'}</span>
        </p>
      </div>
    </div>
  )
}
