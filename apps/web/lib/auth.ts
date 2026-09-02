import { headers } from "next/headers"
import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { pool } from "@/lib/db"

const clientId = process.env.GITHUB_CLIENT_ID
const clientSecret = process.env.GITHUB_CLIENT_SECRET
const github =
  clientId && clientSecret ? { clientId, clientSecret } : undefined

export const GITHUB_SIGN_IN_ENABLED = github !== undefined

export const auth = betterAuth({
  database: pool,
  emailAndPassword: { enabled: true },
  socialProviders: github ? { github } : {},
  // nextCookies() must stay last so it can set the cookies every other plugin queued.
  plugins: [nextCookies()],
})

export async function currentSession() {
  return auth.api.getSession({ headers: await headers() })
}
