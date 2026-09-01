/**
 * Deep scans are off unless deliberately switched on.
 *
 * A deep scan clones the repository into a sandbox and pays a model per commit, and there is
 * no account or billing behind it yet, so nothing an anonymous visitor can reach may start one.
 * The route 404s and the button does not render while this is false.
 *
 * Set `GOODREPO_DEEP_SCAN=1` in the root `.env.local` to work on it. Remove this flag once
 * accounts gate the route properly.
 */
export const DEEP_SCAN_ENABLED = process.env.GOODREPO_DEEP_SCAN === "1"
