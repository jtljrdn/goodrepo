import { Suspense } from "react"
import type { Metadata } from "next"
import { Geist, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Footer } from "@/components/footer"
import { cn } from "@workspace/ui/lib/utils"

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000"

const title = "GoodRepo — agent-readiness score for any GitHub repo"
const description =
  "GoodRepo scores public GitHub repositories for AI agent readiness from measurable, deterministic repository signals."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s · GoodRepo" },
  description,
  openGraph: {
    type: "website",
    siteName: "GoodRepo",
    url: "/",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontSans.variable,
        "font-mono",
        jetbrainsMono.variable
      )}
    >
      <body>
        <ThemeProvider>
          <Suspense>{children}</Suspense>
          <Footer />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
