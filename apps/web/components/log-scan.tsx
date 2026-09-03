import { Suspense } from "react"
import { currentSession, GITHUB_SIGN_IN_ENABLED } from "@/lib/auth"
import { recordScan, type ScanRecord } from "@/lib/history"

// Renders nothing. It exists so the public report page can write history without reading the
// session at the top level, which would make the whole route dynamic and cost every public
// report its prerendered shell. Keep it inside its own Suspense boundary for that reason.
async function Record(props: ScanRecord) {
  if (!GITHUB_SIGN_IN_ENABLED) return null
  const session = await currentSession()
  if (session) await recordScan(session.user.id, props)
  return null
}

export function LogScan(props: ScanRecord) {
  return (
    <Suspense>
      <Record {...props} />
    </Suspense>
  )
}
