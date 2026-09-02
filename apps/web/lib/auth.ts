import { headers } from "next/headers"
import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { pool } from "@/lib/db"

const githubClientId = process.env.GITHUB_CLIENT_ID
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET

// Optional, so a checkout without OAuth credentials still runs on email and password.
const socialProviders =
  githubClientId && githubClientSecret
    ? {
        github: { clientId: githubClientId, clientSecret: githubClientSecret },
      }
    : {}

export const auth = betterAuth({
  database: pool,
  emailAndPassword: { enabled: true },
  socialProviders,
  // nextCookies() must stay last so it can set the cookies every other plugin queued.
  plugins: [nextCookies()],
})

export const GITHUB_SIGN_IN_ENABLED = "github" in socialProviders

export async function currentSession() {
  return auth.api.getSession({ headers: await headers() })
}
