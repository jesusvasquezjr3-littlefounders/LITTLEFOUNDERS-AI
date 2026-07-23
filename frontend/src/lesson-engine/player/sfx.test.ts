// Every SfxName must have its asset in /public/sfx — playSfx swallows load
// errors by design (sound is enhancement, never a requirement), so a missing
// or renamed file would fail SILENTLY in the app. This test is the only
// guardrail that keeps the name↔asset contract honest.
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const SFX_NAMES = [
  'correct',
  'perfect',
  'tryagain',
  'celebration',
  'streak',
  'flip',
  'match',
  'drop',
  'hint',
] as const

describe('sfx assets', () => {
  it.each(SFX_NAMES)('public/sfx/%s.mp3 exists', (name) => {
    expect(existsSync(resolve(__dirname, `../../../public/sfx/${name}.mp3`))).toBe(true)
  })
})
