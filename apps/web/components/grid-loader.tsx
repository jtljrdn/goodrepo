import { cn } from "@workspace/ui/lib/utils"
import styles from "./grid-loader.module.css"

// Negative delays keep both waves moving from the first paint.
const DOTS = Array.from({ length: 25 }, (_, index) => {
  const row = Math.floor(index / 5)
  const column = index % 5
  return {
    diagonal: (row + column) * 100 - 1800,
    radial: Math.hypot(row - 2, column - 2) * 240 - 2400,
  }
})

export function GridLoader({
  className,
  variant = "scan",
}: {
  className?: string
  variant?: "scan" | "deep"
}) {
  return (
    <span aria-hidden="true" className={cn(styles.grid, variant === "deep" && styles.deep, className)}>
      {DOTS.map((dot, index) => (
        <span
          key={index}
          className={styles.cell}
          style={{ animationDelay: `${variant === "deep" ? dot.radial : dot.diagonal}ms` }}
        />
      ))}
    </span>
  )
}
