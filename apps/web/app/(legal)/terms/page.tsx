import Link from "next/link"
import { CONTACT, UPDATED } from "../meta"

export const metadata = {
  title: "Terms",
  description: "The terms you agree to when you use GoodRepo.",
}

export default function TermsPage() {
  return (
    <>
      <h1>Terms of use</h1>
      <p>Last updated {UPDATED}.</p>
      <p>
        GoodRepo scores GitHub repositories for how well an AI agent can work in
        them. By using the site you agree to what follows. If you do not agree,
        do not use it.
      </p>

      <h2>What GoodRepo is</h2>
      <p>
        GoodRepo reads a repository and reports measurable signals: whether a
        README exists, whether tests run, how the project is documented, and so
        on. A score is an opinion built from those signals. It is{" "}
        <strong>not</strong> a security audit, a code review, a licence review,
        or advice you should rely on to make a decision on its own.
      </p>
      <p>
        Scores and recommendations change as the rules change. A report you saw
        yesterday may read differently today.
      </p>

      <h2>Your account</h2>
      <p>
        Signing in is optional and happens only through GitHub. You are
        responsible for the GitHub account you sign in with and for anything
        done under it here.
      </p>
      <p>
        You may disconnect at any time from your GitHub settings, or ask us to
        delete your account by writing to{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>

      <h2>Repositories you scan</h2>
      <p>
        You may scan any public repository. You may scan a private repository
        only where you have the right to do so, and only after you install the
        GoodRepo GitHub App on it yourself. Scanning a private repository gives
        us read access to its contents for the length of that one scan and no
        longer.
      </p>
      <p>
        Do not use GoodRepo to scan repositories you are not allowed to read, or
        to work around anyone&rsquo;s access controls.
      </p>

      <h2>Fair use</h2>
      <p>
        Fast scans are free and unmetered within reason. Deep scans cost real
        money to run, so they are capped per account per day and capped in total
        each month. We may lower or remove those limits, or refuse a scan,
        without notice.
      </p>
      <p>You agree not to:</p>
      <ul>
        <li>Automate the site in a way that degrades it for other people.</li>
        <li>Try to reach data belonging to another account.</li>
        <li>
          Use the scanner to run code, probe systems, or do anything other than
          score a repository.
        </li>
        <li>Resell reports as your own product.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        Your code stays yours. Scanning it does not give us any ownership of it.
        We use it only to produce the report you asked for, as described in the{" "}
        <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>The open-source project</h2>
      <p>
        The GoodRepo source code is published on GitHub under its own licence.
        These terms cover the hosted site, not the code. If you self-host it,
        these terms do not apply to you.
      </p>

      <h2>No warranty</h2>
      <p>
        GoodRepo is provided as-is, with no warranty of any kind. We do not
        promise the site will be available, that a report will be accurate, or
        that a deep scan will finish. Reports are generated in part by automated
        models, which can be wrong.
      </p>

      <h2>Limit of liability</h2>
      <p>
        To the fullest extent the law allows, we are not liable for any indirect
        or consequential loss arising from your use of GoodRepo, including lost
        data, lost profit, or a decision you made because of a report. Nothing
        here limits liability that cannot be limited by law.
      </p>

      <h2>Ending access</h2>
      <p>
        We may suspend or end access to the site at any time, for any reason,
        including breach of these terms. You may stop using it at any time.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. The date at the top says when they last
        changed. Continuing to use the site after a change means you accept it.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </>
  )
}
