import { CATEGORIES } from "@/lib/score"
import type { SignalId } from "@/lib/profile"

const FULL_SHA = /^[0-9a-f]{40}$/i
const REPOSITORY_PART = /^[A-Za-z0-9_.-]{1,100}$/
const SIGNAL_IDS: ReadonlySet<string> = new Set(
  CATEGORIES.flatMap((category) => category.signals.map((signal) => signal.id))
)

export function validRepositoryPart(value: string): boolean {
  return REPOSITORY_PART.test(value)
}

export function parseSelectedIds(value: unknown): SignalId[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40)
    return null
  const ids = value.filter(
    (item): item is SignalId => typeof item === "string" && SIGNAL_IDS.has(item)
  )
  return ids.length === value.length && new Set(ids).size === ids.length
    ? ids
    : null
}

export function readSelectedQuery(
  value: string | string[] | undefined
): SignalId[] {
  if (typeof value !== "string" || value.length > 800) return []
  return parseSelectedIds(value.split(",")) ?? []
}

export function normalizeVerificationRef(
  value: string,
  owner: string,
  repo: string
): string | null | "invalid" {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (FULL_SHA.test(trimmed)) return trimmed.toLowerCase()
  try {
    const url = new URL(trimmed)
    const parts = url.pathname.split("/").filter(Boolean)
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "github.com" ||
      parts.length !== 4 ||
      parts[0]?.toLowerCase() !== owner.toLowerCase() ||
      parts[1]?.toLowerCase() !== repo.toLowerCase() ||
      parts[2] !== "commit" ||
      !FULL_SHA.test(parts[3] ?? "")
    )
      return "invalid"
    return parts[3]!.toLowerCase()
  } catch {
    return "invalid"
  }
}
