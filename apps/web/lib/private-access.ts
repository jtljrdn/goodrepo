import { fetchRepoMeta, isFailure } from "@workspace/analyzer"
import { githubToken } from "@/lib/auth"

export async function confirmPrivateRepository(
  owner: string,
  repo: string,
  repositoryId: string
): Promise<string | null> {
  const token = await githubToken()
  if (!token) return null
  try {
    const meta = await fetchRepoMeta(owner, repo, token)
    return !isFailure(meta) && meta.repositoryId === repositoryId ? token : null
  } catch {
    return null
  }
}
