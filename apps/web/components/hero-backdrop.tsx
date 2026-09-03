"use client"

import { Ascii, CursorRipples, Shader, SimplexNoise } from "shaders/react"

export function HeroBackdrop() {
  return (
    <Shader
      aria-hidden
      disableTelemetry
      className="pointer-events-none absolute inset-0 -z-10 hidden size-full [mask-image:linear-gradient(to_right,transparent_35%,black_85%),linear-gradient(to_bottom,black_60%,transparent)] [mask-composite:intersect] opacity-50 motion-reduce:hidden sm:block dark:opacity-35 [&_canvas]:block [&_canvas]:size-full"
    >
      <CursorRipples
        intensity={3}
        decay={8}
        radius={0.35}
        chromaticSplit={0}
        edges="transparent"
      >
        <Ascii characters="@#%=+:-. " cellSize={14} gamma={1.2}>
          <SimplexNoise
            colorA="#8a8a8a"
            colorB="transparent"
            scale={2.6}
            contrast={0.1}
            balance={-0.1}
            speed={0.08}
          />
        </Ascii>
      </CursorRipples>
    </Shader>
  )
}
