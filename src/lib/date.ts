// YYYY-MM-DD in the user's own timezone. toISOString() is UTC, which in
// Bulgaria (UTC+2/+3) turns local midnight into the previous day.
export function localISODate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
