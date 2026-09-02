import type { Checkout } from "../sandbox"
import type { DeepFinding } from "./review"

export type RejectedFinding = { finding: DeepFinding; reason: string }

export type Verification = { kept: DeepFinding[]; dropped: RejectedFinding[] }

// The model reflows whitespace when it quotes, so compare on collapsed whitespace rather
// than byte-for-byte. Anything looser would stop being evidence.
export function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

const MIN_QUOTE = 12

export function directoriesOf(paths: string[]): Set<string> {
  const dirs = new Set<string>()
  for (const path of paths) {
    const parts = path.split("/")
    for (let i = 1; i < parts.length; i += 1)
      dirs.add(parts.slice(0, i).join("/"))
  }
  return dirs
}

/**
 * Returns null when the finding stands, or the reason it does not.
 *
 * A finding survives only if the repository itself can settle it: the document it accuses
 * is in the checkout, the quote really appears there, and whatever the agent checked to
 * disprove the claim is in the checkout too. That last test is the important one. It is
 * what stops the agent asserting something about an installed dependency, a build output,
 * or any other path a shallow clone never contains.
 */
export function checkFinding(
  finding: DeepFinding,
  files: Set<string>,
  directories: Set<string>,
  quotedText: string | undefined
): string | null {
  if (!files.has(finding.path)) {
    return `${finding.path} is not a file in this repository.`
  }
  if (normalize(finding.quote).length < MIN_QUOTE) {
    return "The quote is too short to locate."
  }
  if (quotedText === undefined) {
    return `${finding.path} could not be read back.`
  }
  if (!normalize(quotedText).includes(normalize(finding.quote))) {
    return `The quote does not appear in ${finding.path}.`
  }
  if (finding.checkedPath === null) {
    return "Nothing in this repository settles the claim."
  }
  if (
    !files.has(finding.checkedPath) &&
    !directories.has(finding.checkedPath)
  ) {
    return `${finding.checkedPath} is not in this repository, so the claim was never checked against it.`
  }
  return null
}

export async function verifyFindings(
  findings: DeepFinding[],
  checkout: Checkout
): Promise<Verification> {
  if (findings.length === 0) return { kept: [], dropped: [] }

  const paths = checkout.entries.map((entry) => entry.path)
  const files = new Set(paths)
  const directories = directoriesOf(paths)

  const quoted = [
    ...new Set(findings.map((f) => f.path).filter((p) => files.has(p))),
  ]
  const texts = await checkout.read(quoted)

  const kept: DeepFinding[] = []
  const dropped: RejectedFinding[] = []
  for (const finding of findings) {
    const reason = checkFinding(
      finding,
      files,
      directories,
      texts.get(finding.path)
    )
    if (reason === null) kept.push(finding)
    else dropped.push({ finding, reason })
  }
  return { kept, dropped }
}
