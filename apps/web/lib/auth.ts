import { headers } from "next/headers"
import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { pool } from "@/lib/db"

const clientId = process.env.GITHUB_CLIENT_ID
const clientSecret = process.env.GITHUB_CLIENT_SECRET

// A GitHub App's user-to-server flow runs on the same two OAuth endpoints as an OAuth app,
// so Better Auth's github provider drives it unchanged. What differs is that the token
// carries no scopes: it can reach exactly the repositories the app is installed on and the
// user can already see. Widening access is a change to the app's permissions and to where
// the user installs it, never a change here.
const github =
  clientId && clientSecret
    ? { clientId, clientSecret, disableDefaultScope: true }
    : undefined

const appSlug = process.env.GITHUB_APP_SLUG

export const GITHUB_SIGN_IN_ENABLED = github !== undefined

export const GITHUB_APP_INSTALL_URL = appSlug
  ? `https://github.com/apps/${appSlug}/installations/new`
  : null

// GitHub is the only way in. Email and password is left off rather than merely hidden: the
// sign-in and sign-up endpoints both read this flag, so the UI and the API close together,
// and no account can exist without an email GitHub already verified.
export const auth = betterAuth({
  database: pool,
  socialProviders: github ? { github } : {},
  plugins: [nextCookies()],
})

export async function currentSession() {
  return auth.api.getSession({ headers: await headers() })
}

// Undefined unless the signed-in user has a usable GitHub token. User tokens expire after
// eight hours; getAccessToken spends the stored refresh token when they do, so callers get a
// live one. It throws once that refresh token is spent too, six months on, or if the user
// revoked the app from GitHub's side. Callers get undefined for all of it and send the user
// back through sign-in, which is the one remedy for every case.
export async function githubToken(): Promise<string | undefined> {
  const requestHeaders = await headers()
  const accounts = await auth.api.listUserAccounts({ headers: requestHeaders })
  const account = accounts.find((a) => a.providerId === "github")
  if (!account) return undefined

  try {
    const { accessToken } = await auth.api.getAccessToken({
      body: { accountId: account.id },
      headers: requestHeaders,
    })
    return accessToken
  } catch {
    return undefined
  }
}
