// Game audio — SFX resolver + BGM manager.
//
// PENDING OWNER DECISION: no game-specific audio asset exists in this repo. The only
// files that exist are the 9 mp3s in `frontend/public/sfx/` (app chrome, generated
// once with ElevenLabs sound-generation — ElevenLabs is SOUND-EFFECTS-ONLY here, TTS
// is qwen3-tts via Echo). Commissioning real arcade SFX and BGM loops is an owner
// call that is deliberately NOT part of this implementation, so this module is built
// asset-tolerant instead of asset-assuming:
//
//   - `GAME_SFX` (core/types.ts) is the MANIFEST vocabulary — what a generated
//     document is allowed to name. It is not a list of files that exist.
//   - `SFX_FILES` below maps each vocabulary name to an EXISTING file where the fit is
//     honest, and to `null` where it is not. `launch`, `explode`, `whoosh`, `alarm`
//     and `engine` have no honest stand-in among the 9, so they resolve to SILENCE
//     rather than to a sound that means something else.
//   - A sound that does not resolve, an autoplay rejection, and a missing file are all
//     SILENT NO-OPS. Never a thrown error, never a console line (these fire on a game
//     tick — one log per event is a log flood).
//   - No BGM loop ships, so the manager stays inert behind `GAME_BGM_ENABLED`.
//
// Every game must be fully playable and fully winnable with zero audio.

import { EXISTING_SFX, type GameBgmId, type GameSfxName } from './types'

type ExistingSfxName = (typeof EXISTING_SFX)[number]

/** Manifest name → an audio file that actually exists, or `null` for silence.
 *  The fallbacks are chosen for meaning, not for coverage: a wrong sound teaches a
 *  wrong cue, so "no sound" is the correct answer whenever no honest match exists. */
const SFX_FILES: Record<GameSfxName, ExistingSfxName | null> = {
  // The 9 real assets, identity-mapped.
  celebration: 'celebration',
  correct: 'correct',
  drop: 'drop',
  flip: 'flip',
  hint: 'hint',
  match: 'match',
  perfect: 'perfect',
  streak: 'streak',
  tryagain: 'tryagain',
  // Honest stand-ins.
  collect: 'correct',
  powerup: 'streak',
  build: 'drop',
  impact: 'tryagain',
  // No honest match among the 9 → silence until real assets land.
  launch: null,
  explode: null,
  whoosh: null,
  alarm: null,
  engine: null,
}

/** Per-NAME volume (not per-file): `collect` fires many times per round where
 *  `correct` fires once per answer, so the same file is played quieter as a game
 *  event. Applied on every play because the Audio element is shared per file. */
const VOLUME: Record<GameSfxName, number> = {
  celebration: 0.55,
  correct: 0.5,
  drop: 0.35,
  flip: 0.35,
  hint: 0.45,
  match: 0.45,
  perfect: 0.55,
  streak: 0.5,
  tryagain: 0.4, // gentler than the win sounds — kind, never punishing
  collect: 0.3,
  powerup: 0.5,
  build: 0.3,
  impact: 0.35,
  launch: 0.4,
  explode: 0.4,
  whoosh: 0.3,
  alarm: 0.4,
  engine: 0.25,
}

/** Which file (if any) a manifest sound name plays today. Exported so the lab and
 *  tests can show the resolution table without touching the Audio API. */
export function resolveGameSfxFile(name: GameSfxName): ExistingSfxName | null {
  return SFX_FILES[name]
}

const sfxCache = new Map<ExistingSfxName, HTMLAudioElement>()

function audioAvailable(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined'
}

/** Play one game sound. Fire-and-forget: re-plays from the start if already playing,
 *  and does nothing at all when muted, unresolved, or unsupported. */
export function playGameSfx(name: GameSfxName): void {
  const file = SFX_FILES[name]
  if (!file) return
  if (isGameAudioMuted()) return
  if (!audioAvailable()) return

  let el = sfxCache.get(file)
  if (!el) {
    el = new Audio(`/sfx/${file}.mp3`)
    el.preload = 'auto'
    sfxCache.set(file, el)
  }
  el.volume = VOLUME[name]
  el.currentTime = 0
  void el.play().catch(() => {
    // Autoplay policy or missing asset. Sound is enhancement, never a requirement,
    // and this path can fire on every tick — swallow it silently.
  })
}

// ---- Mute --------------------------------------------------------------------
//
// One switch for all game audio (SFX + BGM), persisted like the app's other UI
// preferences (`lf-theme`, `lf-sidebar-collapsed`).

const MUTE_KEY = 'lf-game-muted'

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    // Private-mode / disabled storage. A preference that cannot be read is not an
    // error the player should ever see.
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value)
  } catch {
    // Same as above: persistence is best-effort, muting still works for the session.
  }
}

export function isGameAudioMuted(): boolean {
  return readStorage(MUTE_KEY) === '1'
}

/** Persist the mute preference. Takes effect on the next `playGameSfx()` call; a live
 *  BGM controller applies it immediately through its own `setMuted()`. */
export function setGameAudioMuted(muted: boolean): void {
  writeStorage(MUTE_KEY, muted ? '1' : '0')
}

// ---- BGM ---------------------------------------------------------------------

/** The single switch that turns background music on. It stays `false` until real loop
 *  files exist under `frontend/public/bgm/` and `BGM_FILES` names them — enabling BGM
 *  is then a one-line change here, with no call-site edits. While it is `false` every
 *  controller method is an inert no-op except mute persistence.
 *  Annotated `boolean` rather than inferred `false` so the guarded code below is not
 *  analysed as unreachable while the flag is off. */
export const GAME_BGM_ENABLED: boolean = false

/** Loop id → file basename under `/bgm/`. EMPTY on purpose: no loop asset exists. */
const BGM_FILES: Partial<Record<GameBgmId, string>> = {}

const BGM_VOLUME = 0.35
const FADE_STEP_MS = 50

export interface BgmController {
  /** Start (or switch to) a loop. No-op while BGM is disabled or the id has no file. */
  play(id: GameBgmId): void
  stop(): void
  pause(): void
  resume(): void
  /** Ramp volume to `toVolume` (0..1) over `durationMs`. Cancels any running fade. */
  fade(toVolume: number, durationMs: number): void
  setMuted(muted: boolean): void
  isMuted(): boolean
  /** Release the element and any running fade timer. Call from a React cleanup. */
  dispose(): void
}

/** Create a BGM controller. Safe to call unconditionally: with no loop assets
 *  registered it is inert, so the player can be written as if music already existed. */
export function createBgmController(): BgmController {
  let el: HTMLAudioElement | null = null
  let current: GameBgmId | null = null
  let fadeTimer: ReturnType<typeof setInterval> | undefined

  const clearFade = (): void => {
    if (fadeTimer !== undefined) {
      clearInterval(fadeTimer)
      fadeTimer = undefined
    }
  }

  const stop = (): void => {
    clearFade()
    if (el) {
      el.pause()
      el.currentTime = 0
    }
    el = null
    current = null
  }

  return {
    play(id: GameBgmId): void {
      if (!GAME_BGM_ENABLED) return
      const file = BGM_FILES[id]
      if (!file) return
      if (!audioAvailable()) return
      if (current === id && el) return

      stop()
      const next = new Audio(`/bgm/${file}.mp3`)
      next.loop = true
      next.preload = 'auto'
      next.volume = isGameAudioMuted() ? 0 : BGM_VOLUME
      el = next
      current = id
      void next.play().catch(() => {
        // Autoplay is blocked until the player interacts; the next play() call after
        // a tap succeeds. Nothing to report.
      })
    },

    stop,

    pause(): void {
      clearFade()
      el?.pause()
    },

    resume(): void {
      if (!el || isGameAudioMuted()) return
      void el.play().catch(() => {
        // See play().
      })
    },

    fade(toVolume: number, durationMs: number): void {
      clearFade()
      const target = Math.min(1, Math.max(0, toVolume))
      const element = el
      if (!element) return
      if (durationMs <= FADE_STEP_MS) {
        element.volume = target
        return
      }
      const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS))
      const delta = (target - element.volume) / steps
      let remaining = steps
      fadeTimer = setInterval(() => {
        remaining -= 1
        const next = element.volume + delta
        element.volume = Math.min(1, Math.max(0, next))
        if (remaining <= 0) {
          element.volume = target
          clearFade()
        }
      }, FADE_STEP_MS)
    },

    setMuted(muted: boolean): void {
      setGameAudioMuted(muted)
      if (!el) return
      clearFade()
      el.volume = muted ? 0 : BGM_VOLUME
      if (muted) el.pause()
      else
        void el.play().catch(() => {
          // See play().
        })
    },

    isMuted(): boolean {
      return isGameAudioMuted()
    },

    dispose(): void {
      stop()
    },
  }
}
