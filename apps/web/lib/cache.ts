import { unstable_cache } from "next/cache"

/**
 * Caches a result against one immutable commit, for as long as the entry survives.
 *
 * Deliberately not `use cache`. Next composes its key from the build or deployment ID, so
 * nothing cached that way outlives a deploy. That is documented and intentional rather than a
 * bug: the `use cache` reference says "neither caching directive carries over to a new deploy,
 * because the cache key includes the build (or deploymentId) ID", and names `unstable_cache`
 * as the way to persist across deploys. Cache Components has no replacement for that yet.
 *
 * Costing nothing to recompute, the free scan would be fine either way. The deep scan pays a
 * model per miss, so a deploy must not be able to charge for a commit twice.
 *
 * `version` is the manual invalidation lever, and the price of outliving the deployment that
 * wrote the entry. Bump it whenever the cached shape changes *or the code that produced the
 * values does*: detectors, thresholds, scoring, or the agent's questions.
 */
export function cachedByCommit<A extends unknown[], T>(
  name: string,
  version: string,
  compute: (...args: A) => Promise<T>
): (...args: A) => Promise<T> {
  // Arguments are part of the key on top of these parts, so the commit the caller passes is
  // what separates one entry from another.
  return unstable_cache(compute, [name, version], { revalidate: false })
}

/** Thrown from inside a cached function for a result that is true now but not about the commit. */
export const TRANSIENT = "goodrepo:transient"

export function isTransient(error: unknown): boolean {
  return error instanceof Error && error.message === TRANSIENT
}
