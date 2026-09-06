export type FixActionState = {
  status: "idle" | "error" | "saved" | "unchanged" | "unsaved"
  message: string
  planId?: string
  targetSha?: string
  nowPassing?: number
  nowFailing?: number
  coverageChanged?: number
  complete?: boolean
}

export const INITIAL_FIX_ACTION_STATE: FixActionState = {
  status: "idle",
  message: "",
}
