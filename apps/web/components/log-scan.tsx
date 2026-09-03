import { Suspense } from "react"
import { currentSession, GITHUB_SIGN_IN_ENABLED } from "@/lib/auth"
import { recordScan, type ScanRecord } from "@/lib/history"

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
