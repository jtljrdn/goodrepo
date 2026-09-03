import { ImageResponse } from "next/og"

export const alt = "GoodRepo - agent-readiness score for any public GitHub repo"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#ffffff",
        color: "#0a0a0a",
        padding: 80,
        fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            background: "#0a0a0a",
            color: "#ffffff",
            fontSize: 64,
            fontWeight: 700,
          }}
        >
          G
        </div>
        <div style={{ fontSize: 72, fontWeight: 700 }}>GoodRepo</div>
      </div>
      <div style={{ display: "flex", fontSize: 44, lineHeight: 1.3 }}>
        Agent-readiness score for any public GitHub repository.
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 30,
          color: "#737373",
          borderTop: "2px solid #e5e5e5",
          paddingTop: 28,
        }}
      >
        Deterministic signals. Public repos are free.
      </div>
    </div>,
    size
  )
}
