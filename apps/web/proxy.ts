import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// "/" is the signed-in dashboard and "/home" is the landing page. Sending anonymous visitors
// across in the page itself answered 200 with an empty shell instead of a redirect: the page
// is partially prerendered, so the shell is flushed before the session read finishes and
// redirect() can run. Here the answer is a real 307 before any HTML exists.
//
// This only reads the cookie, never the database, because it runs on every matched request
// including prefetches. A cookie that turns out to be stale falls through to the page, which
// does the real check and sends the visitor on to /home.
export const config = { matcher: "/" }

export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()
  return NextResponse.redirect(new URL("/home", request.url), 307)
}
