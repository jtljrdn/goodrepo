import { cacheLife } from "next/cache"
import Link from "next/link"

const REPO = "jtljrdn/goodrepo"

async function starCount(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`)
    if (!res.ok) return null
    const data = (await res.json()) as { stargazers_count?: number }
    return data.stargazers_count ?? null
  } catch {
    return null
  }
}

// The star count and the copyright year both refresh hourly. Without this the
// footer made an uncached GitHub call on every single page render.
export async function Footer() {
  "use cache"
  cacheLife("hours")

  const stars = await starCount()

  return (
    <footer className="border-border/60 mt-16 border-t">
      <div className="text-muted-foreground mx-auto flex max-w-5xl flex-col gap-3 px-6 py-6 text-xs sm:flex-row sm:items-center">
        <span>© {new Date().getFullYear()} GoodRepo</span>
        <nav className="flex flex-wrap items-center gap-4 sm:ml-auto">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <a
            href="https://www.npmjs.com/package/goodrepo"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            npm
          </a>
          <a
            href={`https://github.com/${REPO}`}
            target="_blank"
            rel="noreferrer"
            className="border-border/60 hover:text-foreground inline-flex items-center gap-1.5 border px-2 py-1"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 fill-current">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            Star
            {stars !== null && (
              <span className="border-border/60 border-l pl-1.5 tabular-nums">
                {stars.toLocaleString()}
              </span>
            )}
          </a>
        </nav>
      </div>
    </footer>
  )
}
