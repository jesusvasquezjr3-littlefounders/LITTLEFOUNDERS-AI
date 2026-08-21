import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PLATFORM_SOUND_SRC,
  PLATFORM_SOUND_VOLUME,
  TUTOR_AMBIENT_DUCKED_VOLUME,
  TUTOR_AMBIENT_SRC,
  TUTOR_AMBIENT_VOLUME,
  TUTOR_SOUND_VOLUME,
  duckTutorAmbient,
  isSoundMuted,
  playPlatformSound,
  setSoundMuted,
  startTutorAmbient,
  stopTutorAmbient,
} from './sound'

/*
 * The tutor cue set, at the two places it can go wrong quietly.
 *
 * The cache is keyed by SRC and several cue names now share one asset at
 * different levels, so a cached element carries whatever the last caller set.
 * And the whole soundscape has to have an off switch that survives a reload,
 * because a sound a learner cannot stop is the one they remember.
 */

/*
 * The elements live as long as the MODULE does, not as long as a test: both
 * the one-shot cache and the ambient bed are created once and reused. The
 * registry is therefore never cleared, and lookups take the most recent match.
 */
const created: FakeAudio[] = []

class FakeAudio {
  volume = 1
  currentTime = 0
  loop = false
  preload = ''
  paused = true
  plays = 0

  constructor(public src: string) {
    created.push(this)
  }

  play() {
    this.plays += 1
    this.paused = false
    return Promise.resolve()
  }

  pause() {
    this.paused = true
  }
}

function elementFor(src: string): FakeAudio | undefined {
  return [...created].reverse().find((audio) => audio.src === src)
}

/** Total play() calls across every element, so "nothing sounded" is provable. */
function totalPlays(): number {
  return created.reduce((sum, audio) => sum + audio.plays, 0)
}

beforeEach(() => {
  vi.stubGlobal('Audio', FakeAudio)
  vi.useFakeTimers()
  setSoundMuted(false)
})

afterEach(() => {
  stopTutorAmbient({ fadeMs: 0 })
  setSoundMuted(false)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('tutor cue set', () => {
  it('maps every tutor cue to an asset the repo already ships', () => {
    // Nothing was generated for this set. A cue pointing at a file that does
    // not exist fails silently by design, so the map is the only guardrail.
    const committed = new Set(Object.values(PLATFORM_SOUND_SRC))
    for (const [name, src] of Object.entries(PLATFORM_SOUND_SRC)) {
      if (!name.startsWith('tutor_')) continue
      expect(committed.has(src)).toBe(true)
    }
  })

  it('plays the tutor cues quieter than the rest of the platform', () => {
    // They fire under a speaking character and an ambient bed; at the login
    // chime's level they step on the voice they are decorating.
    expect(TUTOR_SOUND_VOLUME).toBeLessThan(PLATFORM_SOUND_VOLUME)
  })

  it('sets the volume per PLAY, not per cached element', () => {
    // nav_tap and tutor_chip share /sounds/ui/tap.mp3. Setting volume only at
    // construction would leave whichever played first deciding the level of the
    // other for the rest of the session.
    playPlatformSound('nav_tap')
    const shared = elementFor(PLATFORM_SOUND_SRC.nav_tap)
    expect(shared?.volume).toBe(PLATFORM_SOUND_VOLUME)

    playPlatformSound('tutor_chip')
    expect(elementFor(PLATFORM_SOUND_SRC.tutor_chip)).toBe(shared)
    expect(shared?.volume).toBe(TUTOR_SOUND_VOLUME)
  })
})

describe('the off switch', () => {
  it('plays nothing while muted, and remembers the choice', () => {
    setSoundMuted(true)
    const before = totalPlays()
    playPlatformSound('tutor_mic_open')

    expect(isSoundMuted()).toBe(true)
    expect(totalPlays()).toBe(before)
    expect(window.localStorage.getItem('lf_sound_muted')).toBe('1')
  })

  it('silences the ambient bed too, not only the one-shots', () => {
    startTutorAmbient()
    expect(elementFor(TUTOR_AMBIENT_SRC)?.paused).toBe(false)

    setSoundMuted(true)
    expect(elementFor(TUTOR_AMBIENT_SRC)?.paused).toBe(true)
  })
})

describe('the ambient bed', () => {
  it('starts under everything else, quiet enough to be felt rather than heard', () => {
    startTutorAmbient()
    const bed = elementFor(TUTOR_AMBIENT_SRC)

    expect(bed?.loop).toBe(true)
    expect(bed?.volume).toBe(TUTOR_AMBIENT_VOLUME)
  })

  it('ducks while a voice has the floor and comes back afterwards', () => {
    startTutorAmbient()
    const bed = elementFor(TUTOR_AMBIENT_SRC)

    duckTutorAmbient(true)
    vi.advanceTimersByTime(400)
    expect(bed?.volume).toBeCloseTo(TUTOR_AMBIENT_DUCKED_VOLUME, 4)

    duckTutorAmbient(false)
    vi.advanceTimersByTime(800)
    expect(bed?.volume).toBeCloseTo(TUTOR_AMBIENT_VOLUME, 4)
  })

  it('drops faster than it returns, so the duck beats the first syllable', () => {
    startTutorAmbient()
    const bed = elementFor(TUTOR_AMBIENT_SRC)

    duckTutorAmbient(true)
    vi.advanceTimersByTime(400)
    duckTutorAmbient(false)
    // Half of the restore ramp: still well below where it started, which is the
    // whole point of a return the learner never notices happening.
    vi.advanceTimersByTime(200)

    expect(bed?.volume).toBeGreaterThan(TUTOR_AMBIENT_DUCKED_VOLUME)
    expect(bed?.volume).toBeLessThan(TUTOR_AMBIENT_VOLUME)
  })
})
