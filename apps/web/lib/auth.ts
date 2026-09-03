import { headers } from "next/headers"
import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { pool } from "@/lib/db"

const clientId = process.env.GITHUB_CLIENT_ID
const clientSecret = process.env.GITHUB_CLIENT_SECRET

const github =
  clientId && clientSecret
    ? { clientId, clientSecret, disableDefaultScope: true }
    : undefined

const appSlug = process.env.GITHUB_APP_SLUG

export const GITHUB_SIGN_IN_ENABLED = github !== undefined

export const GITHUB_APP_INSTALL_URL = appSlug
  ? `https://github.com/apps/${appSlug}/installations/new`
  : null

const SESSION_CACHE_SECONDS = 300

export const auth = betterAuth({
  database: pool,
  socialProviders: github ? { github } : {},
  session: { cookieCache: { enabled: true, maxAge: SESSION_CACHE_SECONDS } },
  plugins: [nextCookies()],
})

export async function currentSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function verifiedSession() {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  })
}

export async function githubToken(): Promise<string | undefined> {
  try {
    const requestHeaders = await headers()
    const accounts = await auth.api.listUserAccounts({
      headers: requestHeaders,
    })
    const account = accounts.find((a) => a.providerId === "github")
    if (!account) return undefined

    const { accessToken } = await auth.api.getAccessToken({
      body: { accountId: account.id },
      headers: requestHeaders,
    })
    return accessToken
  } catch {
    return undefined
  }
}
