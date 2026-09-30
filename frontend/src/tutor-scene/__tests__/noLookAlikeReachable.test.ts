import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * Frontend Bible 02 rule 21 and D12, 07 §4, 08 §7 (gap-fix round 8): a Mentor
 * character is only ever a render of its real 3D model, and the fallback is a
 * still of the same model. The hand-drawn 2D characters are deleted; this
 * walks every module the app entry can reach, statically or through a lazy
 * `import()`, and refuses any that is (or brings back) a look-alike.
 */

const SRC = resolve(__dirname, '..', '..')
const ENTRY = join(SRC, 'main.tsx')
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']
const SPECIFIERS = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g

function resolveModule(from: string, spec: string): string | null {
  const clean = spec.split('?')[0]!
  let base: string
  if (clean.startsWith('@/')) base = join(SRC, clean.slice(2))
  else if (clean.startsWith('.')) base = resolve(dirname(from), clean)
  else return null
  for (const ext of EXTENSIONS) {
    const candidate = base + ext
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

function reachable(entry: string): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    if (!/\.(tsx?|jsx?)$/.test(file)) continue
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(SPECIFIERS)) {
      const spec = match[1] ?? match[2] ?? match[3]
      if (!spec) continue
      const target = resolveModule(file, spec)
      if (target && !seen.has(target)) queue.push(target)
    }
  }
  return seen
}

const REACHED = [...reachable(ENTRY)].map((file) => relative(SRC, file).split('\\').join('/'))

describe('no look-alike Mentor character is reachable from the app entry', () => {
  it('walks the real graph, down to the character layer and its stills', () => {
    // A walk that reached nothing would pass by looking at nothing.
    expect(REACHED.length).toBeGreaterThan(200)
    expect(REACHED).toContain('tutor-scene/CharacterLayer.tsx')
    expect(REACHED).toContain('tutor-scene/slotStill.ts')
  })

  it('reaches no hand-drawn character, no 2D actor and no rig sheet', () => {
    const flat = REACHED.filter((file) =>
      /^components\/characters\/[A-Za-z]+Character\.tsx$/.test(file)
      || /^components\/characters\/control\/(CharacterActor\.tsx|rig\.css)$/.test(file))
    expect(flat).toEqual([])
  })

  it('reaches no module under components/characters that draws an inline SVG', () => {
    const drawn = REACHED.filter((file) => file.startsWith('components/characters/')
      && /<svg[\s>]/.test(readFileSync(join(SRC, file), 'utf8')))
    expect(drawn).toEqual([])
  })
})
