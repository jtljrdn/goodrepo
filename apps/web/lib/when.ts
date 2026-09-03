const DAY_MS = 86_400_000

export function relativeDays(then: Date, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - then.getTime()) / DAY_MS)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? "a month ago" : `${months} months ago`
}
