"use client"

import * as React from "react"

export function Elapsed() {
  const [seconds, setSeconds] = React.useState(0)

  React.useEffect(() => {
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return <span className="tabular-nums">{seconds}s elapsed</span>
}
