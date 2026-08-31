const BLOCK = 512

export type TarEntry = {
  kind: "file" | "paxGlobal"
  path: string
  size: number
  body: Uint8Array | null
}

class ByteReader {
  private chunks: Uint8Array[] = []
  private len = 0

  constructor(private readonly iter: AsyncIterator<Uint8Array>) {}

  private async fill(n: number): Promise<boolean> {
    while (this.len < n) {
      const next = await this.iter.next()
      if (next.done) return false
      this.chunks.push(next.value)
      this.len += next.value.length
    }
    return true
  }

  private take(n: number): Uint8Array {
    const out = new Uint8Array(n)
    let off = 0
    while (off < n) {
      const head = this.chunks[0]
      if (!head) break
      const size = Math.min(head.length, n - off)
      out.set(head.subarray(0, size), off)
      off += size
      if (size === head.length) this.chunks.shift()
      else this.chunks[0] = head.subarray(size)
      this.len -= size
    }
    return out
  }

  async read(n: number): Promise<Uint8Array | null> {
    if (!(await this.fill(n))) return null
    return this.take(n)
  }

  async skip(n: number): Promise<boolean> {
    let left = n
    while (left > 0) {
      if (this.len === 0 && !(await this.fill(1))) return false
      const head = this.chunks[0]
      if (!head) return false
      const size = Math.min(head.length, left)
      if (size === head.length) this.chunks.shift()
      else this.chunks[0] = head.subarray(size)
      this.len -= size
      left -= size
    }
    return true
  }
}

const decoder = new TextDecoder()

function field(block: Uint8Array, start: number, length: number): string {
  const text = decoder.decode(block.subarray(start, start + length))
  const end = text.indexOf("\0")
  return end === -1 ? text : text.slice(0, end)
}

function octal(block: Uint8Array, start: number, length: number): number {
  const text = field(block, start, length).trim()
  const value = parseInt(text, 8)
  return Number.isFinite(value) ? value : 0
}

export async function* readTar(
  stream: AsyncIterable<Uint8Array>,
  wantBody: (path: string, size: number) => boolean
): AsyncGenerator<TarEntry> {
  const reader = new ByteReader(stream[Symbol.asyncIterator]())

  while (true) {
    const header = await reader.read(BLOCK)
    if (!header) return
    if (header.every((byte) => byte === 0)) return

    const size = octal(header, 124, 12)
    const padded = Math.ceil(size / BLOCK) * BLOCK
    const typeByte = header[156] ?? 0
    const type = typeByte === 0 ? "0" : String.fromCharCode(typeByte)

    const name = field(header, 0, 100)
    const prefix = field(header, 345, 155)
    const path = prefix ? `${prefix}/${name}` : name

    if (type === "g") {
      const body = await reader.read(padded)
      yield { kind: "paxGlobal", path, size, body: body?.subarray(0, size) ?? null }
      continue
    }

    if (type !== "0") {
      if (!(await reader.skip(padded))) return
      continue
    }

    if (wantBody(path, size)) {
      const body = await reader.read(padded)
      if (!body) return
      yield { kind: "file", path, size, body: body.subarray(0, size) }
    } else {
      yield { kind: "file", path, size, body: null }
      if (!(await reader.skip(padded))) return
    }
  }
}
