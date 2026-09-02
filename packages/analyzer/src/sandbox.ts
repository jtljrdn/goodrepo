import { Sandbox } from "@vercel/sandbox"
import { CAPS } from "./thresholds"
import type { TreeEntry } from "./types"

export type CheckoutTarget = {
  owner: string
  repo: string
  revision?: string
  token?: string
}

export type Checkout = {
  entries: TreeEntry[]
  read: (paths: string[]) => Promise<Map<string, string>>
  run: (
    command: string,
    args: string[]
  ) => Promise<{ stdout: string; exitCode: number }>
}

export class CheckoutError extends Error {}

export function parseLsTree(output: string): TreeEntry[] {
  const entries: TreeEntry[] = []
  for (const line of output.split("\n")) {
    const tab = line.indexOf("\t")
    if (tab === -1) continue
    const fields = line.slice(0, tab).trim().split(/\s+/)
    if (fields.length < 4 || fields[1] !== "blob") continue
    const bytes = Number(fields[3])
    entries.push({
      path: line.slice(tab + 1),
      bytes: Number.isFinite(bytes) ? bytes : 0,
    })
  }
  return entries
}

function gitSource(target: CheckoutTarget) {
  const url = `https://github.com/${target.owner}/${target.repo}.git`
  const base = {
    type: "git" as const,
    url,
    depth: 1,
    revision: target.revision,
  }
  return target.token
    ? { ...base, username: "x-access-token", password: target.token }
    : base
}

export async function withCheckout<T>(
  target: CheckoutTarget,
  fn: (checkout: Checkout) => Promise<T>
): Promise<T> {
  const sandbox = await Sandbox.create({
    source: gitSource(target),
    runtime: "node24",
    resources: { vcpus: CAPS.sandboxVcpus },
    timeout: CAPS.sandboxTimeoutMs,
    persistent: false,
  })

  try {
    const run = async (command: string, args: string[]) => {
      const result = await sandbox.runCommand(command, args)
      return { stdout: await result.stdout(), exitCode: result.exitCode }
    }

    const listed = await run("git", ["ls-tree", "-r", "--long", "HEAD"])
    if (listed.exitCode !== 0) {
      throw new CheckoutError(
        `Could not list files in ${target.owner}/${target.repo}.`
      )
    }

    const read = async (paths: string[]) => {
      const texts = new Map<string, string>()
      const buffers = await Promise.all(
        paths.map(async (path) => {
          const buffer = await sandbox.readFileToBuffer({
            path,
            cwd: sandbox.cwd,
          })
          return [path, buffer] as const
        })
      )
      for (const [path, buffer] of buffers) {
        if (buffer) texts.set(path, buffer.toString("utf8"))
      }
      return texts
    }

    return await fn({ entries: parseLsTree(listed.stdout), read, run })
  } finally {
    await sandbox.stop()
  }
}
