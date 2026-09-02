import { unstable_cache } from "next/cache"

export function cachedByCommit<A extends unknown[], T>(
  name: string,
  version: string,
  compute: (...args: A) => Promise<T>
): (...args: A) => Promise<T> {
  return unstable_cache(compute, [name, version], { revalidate: false })
}

export const TRANSIENT = "goodrepo:transient"

export function isTransient(error: unknown): boolean {
  return error instanceof Error && error.message === TRANSIENT
}
