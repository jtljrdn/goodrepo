import { redirect } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { ReportShell, ReportView, FailureCard } from "@/components/report-view"
import { ReconnectGitHub } from "@/components/reconnect-github"
import { LogScan } from "@/components/log-scan"
import {
  currentSession,
  githubToken,
  GITHUB_APP_INSTALL_URL,
  GITHUB_SIGN_IN_ENABLED,
} from "@/lib/auth"
import { failureMessage, readSha, runPrivateScan } from "@/lib/scan"

export const maxDuration = 300

export async function generateMetadata(
  props: PageProps<"/[owner]/[repo]/private">
) {
  const { owner, repo } = await props.params
  return {
    title: `${owner}/${repo} · private scan`,
    robots: { index: false, follow: false },
  }
}

function InstallLink({ children }: { children: React.ReactNode }) {
  if (!GITHUB_APP_INSTALL_URL) return null
  return (
    <a href={GITHUB_APP_INSTALL_URL} target="_blank" rel="noreferrer noopener">
      <Button variant="outline" size="sm">
        {children}
      </Button>
    </a>
  )
}

export default async function PrivateReportPage(
  props: PageProps<"/[owner]/[repo]/private">
) {
  const { owner, repo } = await props.params
  const ref = readSha((await props.searchParams).sha)
  const query = ref ? `?sha=${ref}` : ""
  const here = `/${owner}/${repo}/private${query}`

  const session = await currentSession()
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(here)}`)

  const token = GITHUB_SIGN_IN_ENABLED ? await githubToken() : undefined

  if (!token) {
    return (
      <ReportShell owner={owner} repo={repo}>
        <FailureCard
          title="Reconnect GitHub to scan this"
          detail={
            GITHUB_SIGN_IN_ENABLED
              ? "GoodRepo reads private repositories using your GitHub access, and that access has expired. Sign in again to restore it."
              : "Sign-in is not set up on this deployment, so private repositories cannot be scanned here."
          }
        >
          {GITHUB_SIGN_IN_ENABLED ? <ReconnectGitHub next={here} /> : null}
        </FailureCard>
      </ReportShell>
    )
  }

  const result = await runPrivateScan(owner, repo, token, ref)

  if (!result.ok) {
    const { title, detail } = failureMessage(result.failure)
    return (
      <ReportShell owner={owner} repo={repo}>
        <FailureCard title={title} detail={detail}>
          {result.failure.kind === "not-found" ? (
            <InstallLink>Choose repositories on GitHub</InstallLink>
          ) : null}
        </FailureCard>
      </ReportShell>
    )
  }

  return (
    <ReportShell
      owner={result.profile.owner}
      repo={result.profile.repo}
      sha={result.profile.commitSha}
    >
      <LogScan
        owner={result.profile.owner}
        repo={result.profile.repo}
        commitSha={result.profile.commitSha}
        kind="private"
        score={result.overall}
      />
      <ReportView
        profile={result.profile}
        overall={result.overall}
        categories={result.categories}
        sha={ref}
        deepAvailable={false}
      />
    </ReportShell>
  )
}
