import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

export const config = { matcher: ["/", "/dashboard"] }

export function proxy(request: NextRequest) {
  const signedIn = getSessionCookie(request) !== null

  if (request.nextUrl.pathname === "/dashboard") {
    if (signedIn) return NextResponse.next()
    return NextResponse.redirect(new URL("/", request.url), 307)
  }

  if (signedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 307)
  }
  return NextResponse.next()
}
