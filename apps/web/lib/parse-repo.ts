const REPO_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/

export function parseRepoInput(value: string) {
  const match = REPO_PATTERN.exec(value.trim())
  if (!match) return null
  const [, owner, repo] = match
  if (!owner || !repo || owner === "github.com") return null
  return { owner, repo }
}
