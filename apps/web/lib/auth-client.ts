import { createAuthClient } from "better-auth/react"

// No baseURL: the client is served from the same origin as the handler.
export const authClient = createAuthClient()
