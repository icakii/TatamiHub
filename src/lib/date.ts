// YYYY-MM-DD in the user's own timezone. toISOString() is UTC, which in
// Bulgaria (UTC+2/+3) turns local midnight into the previous day.
export function localISODate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Only real web links become clickable; anything else (javascript:, data:)
// that might reach the database is shown as plain text.
export function safeHttpUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null
}
