"use client"

import { Dither, Shader, SimplexNoise } from "shaders/react"

export function AuthBackdrop() {
  return (
    <Shader
      aria-hidden
      disableTelemetry
      className="pointer-events-none absolute inset-0 size-full [mask-image:linear-gradient(to_bottom,black,transparent_70%),radial-gradient(ellipse_60%_70%_at_center,transparent_30%,black_100%)] [mask-composite:intersect] opacity-40 motion-reduce:hidden dark:opacity-30 [&_canvas]:block [&_canvas]:size-full"
    >
      <Dither
        pattern="blueNoise"
        pixelSize={2}
        threshold={0.6}
        spread={0.35}
        colorA="transparent"
        colorB="#9a9a9a"
      >
        <SimplexNoise
          colorA="#ffffff"
          colorB="#000000"
          scale={0.6}
          contrast={0.3}
          balance={-0.35}
          speed={0.1}
        />
      </Dither>
    </Shader>
  )
}
