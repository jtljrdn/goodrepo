import Link from "next/link"
import { CONTACT, UPDATED } from "../meta"

export const metadata = {
  title: "Privacy",
  description: "What GoodRepo collects, why, and who else sees it.",
}

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p>Last updated {UPDATED}.</p>
      <p>
        GoodRepo collects as little as it can. There are no advertising
        trackers, no third-party analytics cookies, and nothing is sold. This
        page says exactly what is kept and who else touches it.
      </p>

      <h2>Scanning without an account</h2>
      <p>
        Scanning a public repository needs no account and stores nothing about
        you. GoodRepo reads the repository through the public GitHub API and
        keeps the finished report in a cache keyed by the commit it scanned, so
        the next person asking for the same commit gets the same answer without
        a second scan. That cache holds facts about the repository, not about
        the person who asked.
      </p>

      <h2>If you sign in</h2>
      <p>
        Signing in is only through GitHub. There are no passwords here, and no
        email is ever sent. GitHub gives us, and we store:
      </p>
      <ul>
        <li>Your GitHub user ID, username, display name and avatar URL.</li>
        <li>The email address on your GitHub account.</li>
        <li>
          An access token and a refresh token, used to read repositories on your
          behalf. Tokens expire, and are refreshed only while you keep using the
          site.
        </li>
        <li>A session, held in a cookie in your browser.</li>
      </ul>
      <p>
        The session cookie is strictly necessary to keep you signed in. It is
        the only cookie GoodRepo sets.
      </p>
      <p>
        The token carries no broad permissions. GoodRepo is a GitHub{" "}
        <strong>App</strong>, not an OAuth app, so it can read only the
        repositories you install it on, and only the parts it asked for
        (contents and metadata, read-only). It can never see a repository you
        could not see yourself, and it can never write.
      </p>

      <h2>Private repository scans</h2>
      <p>
        A private scan reads the repository using your own token, at the moment
        you ask for it. The result is <strong>never cached</strong> and never
        written to disk. It exists for the length of the request that produced
        it and nothing else. Nobody else can load the report, and the report
        cannot outlive your access to the repository.
      </p>

      <h2>Deep scans</h2>
      <p>
        A deep scan checks out the repository into a short-lived sandbox and
        asks a language model a fixed set of questions about it. Source code
        from the repository is sent to that model to be answered. Deep scans run
        on public repositories only.
      </p>
      <p>For each deep scan we record one row:</p>
      <ul>
        <li>Your account ID, the repository owner and name, and the commit.</li>
        <li>When the run happened.</li>
      </ul>
      <p>
        That row exists to enforce the daily and monthly limits and to keep
        re-reading a report you already ran free. Deleting your account removes
        the link to you but keeps the row, so a month&rsquo;s spend cannot be
        reset by deleting an account.
      </p>

      <h2>Analytics</h2>
      <p>
        The site uses Vercel Web Analytics, which counts page views without
        cookies and without building a profile of you. It does not follow you to
        other sites.
      </p>

      <h2>Who else sees your data</h2>
      <ul>
        <li>
          <strong>Vercel</strong> hosts the site, runs the sandbox, routes model
          requests and provides analytics. Vercel sees request logs.
        </li>
        <li>
          <strong>Supabase</strong> hosts the Postgres database holding accounts
          and deep-scan records.
        </li>
        <li>
          <strong>GitHub</strong> is the source of every repository we read and
          the only sign-in provider.
        </li>
        <li>
          <strong>Anthropic</strong> is the model provider used for deep scans.
          Repository content sent for a deep scan is not used to train models.
        </li>
      </ul>
      <p>Nothing is sold, rented, or shared with anyone else.</p>

      <h2>How long things are kept</h2>
      <ul>
        <li>Account details and tokens: until you delete your account.</li>
        <li>
          Deep-scan records: kept, with the link to your account removed when
          your account is deleted.
        </li>
        <li>Cached public reports: until the scanning rules change.</li>
        <li>Private scan results: not kept at all.</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Stop private access:</strong> uninstall the GoodRepo GitHub
          App, or remove a repository from it, in your GitHub settings. Access
          ends immediately.
        </li>
        <li>
          <strong>Sign out:</strong> clears the session cookie.
        </li>
        <li>
          <strong>Delete your account, or ask for a copy of your data:</strong>{" "}
          write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </li>
      </ul>
      <p>
        Depending on where you live you may also have the right to correct your
        data, object to its use, or complain to a data protection authority. Ask
        and we will help.
      </p>

      <h2>Children</h2>
      <p>
        GoodRepo is not intended for anyone under 13, and we do not knowingly
        keep data about them.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy. The date at the top says when it last
        changed.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also
        the <Link href="/terms">terms of use</Link>.
      </p>
    </>
  )
}
