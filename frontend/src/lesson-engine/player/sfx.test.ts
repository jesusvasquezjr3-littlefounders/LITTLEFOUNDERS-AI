// Every mapped sound must have its asset in /public/sounds — playSfx and
// playPlatformSound swallow load errors by design (sound is enhancement,
// never a requirement), so a missing or renamed file would fail SILENTLY in
// the app. These tests are the only guardrail keeping the name↔asset contract
// honest. The volume pins protect v1 fidelity: v1 played one-shots at Howler
// instance volume 0.15 under a 0.5 master (audible 0.075) and the lesson BGM
// at 0.3 × 0.5 = 0.15 — see sfx.ts; "restoring" the raw numbers would double
// the loudness v1 actually had.
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { BGM_SRC, BGM_VOLUME, SFX_SRC, SFX_VOLUME } from './sfx'
import { PLATFORM_SOUND_SRC, PLATFORM_SOUND_VOLUME } from '../../lib/sound'

const PUBLIC_DIR = resolve(__dirname, '../../../public')

describe('sound assets (v1 set)', () => {
  it.each(Object.entries(SFX_SRC))('lesson sfx %s → %s exists', (_name, src) => {
    expect(existsSync(resolve(PUBLIC_DIR, `.${src}`))).toBe(true)
  })

  it.each(Object.entries(PLATFORM_SOUND_SRC))('platform sound %s → %s exists', (_name, src) => {
    expect(existsSync(resolve(PUBLIC_DIR, `.${src}`))).toBe(true)
  })

  it('lesson BGM asset exists', () => {
    expect(existsSync(resolve(PUBLIC_DIR, `.${BGM_SRC}`))).toBe(true)
  })
})

describe('v1 volume fidelity', () => {
  it('one-shots play at v1 audible level 0.15 × 0.5', () => {
    expect(SFX_VOLUME).toBe(0.075)
    expect(PLATFORM_SOUND_VOLUME).toBe(0.075)
  })

  it('lesson BGM plays at v1 audible level 0.3 × 0.5', () => {
    expect(BGM_VOLUME).toBe(0.15)
  })
})

describe('v1 context mapping', () => {
  it('lesson outcomes use the v1 edu sounds', () => {
    expect(SFX_SRC.correct).toBe('/sounds/edu/success.mp3')
    // B.26: a miss never plays an error sound.
    expect(SFX_SRC.tryagain).toBe('/sounds/ui/tap.mp3')
    expect(Object.values(SFX_SRC).some((src) => /error|fail|buzz|wrong/.test(src))).toBe(false)
    expect(SFX_SRC.celebration).toBe('/sounds/edu/lesson_complete.mp3')
  })

  it('in-activity interactions use the v1 ui tap sound', () => {
    expect(SFX_SRC.flip).toBe('/sounds/ui/tap.mp3')
    expect(SFX_SRC.match).toBe('/sounds/ui/tap.mp3')
    expect(SFX_SRC.drop).toBe('/sounds/ui/tap.mp3')
  })
})
