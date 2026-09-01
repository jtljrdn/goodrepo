"use client"

import * as React from "react"

/** Honest feedback during a wait long enough that a static spinner reads as a hang. */
export function Elapsed() {
  const [seconds, setSeconds] = React.useState(0)

  React.useEffect(() => {
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return <span className="tabular-nums">{seconds}s elapsed</span>
}
