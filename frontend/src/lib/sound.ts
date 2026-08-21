// Platform-wide UI sounds — the original v1 LittleFounders set (rescued from
// v1 `main` @ f4d09ad, /public/sounds), at v1's audible level: one-shots
// played at Howler instance volume 0.15 under the global Howler.volume(0.5)
// master, so the effective product 0.15 × 0.5 = 0.075 is set directly here.
// v1 contexts (SoundContext call sites): auth_success on login/signup/OAuth
// success, auth_error on those failures, auth_bye on logout (TopNav), and
// nav taps reused the ui tap asset (nav_slide → tap.mp3). Same fire-and-forget
// contract as the lesson player's sfx.ts: autoplay rejections and missing
// assets are swallowed — sound is enhancement, never a requirement.

export type PlatformSoundName =
  | 'auth_success'
  | 'auth_error'
  | 'auth_bye'
  | 'nav_tap'
  // The tutor set. Every cue maps to an asset already committed under
  // /public/sounds — nothing new was generated for this, because an
  // unshippable sound is worse than a reused one.
  | 'tutor_mic_open'
  | 'tutor_mic_close'
  | 'tutor_chip'
  | 'tutor_reveal'
  | 'tutor_camera'
  | 'tutor_notice'

/** v1 one-shot audible level: instance 0.15 × Howler master 0.5. */
export const PLATFORM_SOUND_VOLUME = 0.075

/**
 * The tutor's own cues sit lower than the rest of the platform.
 *
 * They fire while a character is speaking and while an ambient bed is playing,
 * and a cue mixed at the same level as a login chime steps on the voice it is
 * supposed to be decorating.
 */
export const TUTOR_SOUND_VOLUME = 0.06

export const PLATFORM_SOUND_SRC: Record<PlatformSoundName, string> = {
  auth_success: '/sounds/auth/success.mp3',
  auth_error: '/sounds/auth/error.mp3',
  auth_bye: '/sounds/auth/bye.mp3',
  nav_tap: '/sounds/ui/tap.mp3',
  tutor_mic_open: '/sounds/ui/tap.mp3',
  tutor_mic_close: '/sounds/ui/toggle.mp3',
  tutor_chip: '/sounds/ui/tap.mp3',
  tutor_reveal: '/sounds/edu/unlock.mp3',
  // A camera move has no committed asset. The toggle's short air-swish is the
  // closest thing we own, and reusing it beats shipping a generated one-off
  // for a cue that may not survive the first review.
  tutor_camera: '/sounds/ui/toggle.mp3',
  tutor_notice: '/sounds/ui/notification.mp3',
}

const TUTOR_SOUNDS: ReadonlySet<PlatformSoundName> = new Set<PlatformSoundName>([
  'tutor_mic_open',
  'tutor_mic_close',
  'tutor_chip',
  'tutor_reveal',
  'tutor_camera',
  'tutor_notice',
])

/** Persisted across sessions: a learner who turned sound off meant it. */
const MUTE_KEY = 'lf_sound_muted'

const cache = new Map<string, HTMLAudioElement>()

/**
 * Start playback and swallow every way it can fail.
 *
 * `HTMLMediaElement.play()` returns a promise in modern browsers and NOTHING in
 * older ones and under jsdom, so `el.play().catch(...)` throws a TypeError on
 * exactly the environments that were supposed to degrade quietly. These cues
 * fire from inside the microphone's pointer handler, so a throw here would take
 * the hold down with it: the accent would break the feature it decorates.
 */
function playQuietly(el: HTMLAudioElement): void {
  try {
    const started: unknown = el.play()
    if (started instanceof Promise) started.catch(() => {})
  } catch {
    // Autoplay policy, a missing asset, or a browser with no promise here.
  }
}

let muted = readMuted()

function readMuted(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    // Private mode, or storage denied. Defaulting to unmuted matches what the
    // platform did before this preference existed.
    return false
  }
}

/** Whether every cue and the ambient bed are currently silenced. */
export function isSoundMuted(): boolean {
  return muted
}

/**
 * Turn all product sound on or off, and remember it.
 *
 * The control that calls this is not built in this increment. It is exposed now
 * so that no cue added here can ship without an off switch existing — a sound a
 * learner cannot stop is the one they remember.
 */
export function setSoundMuted(next: boolean): void {
  muted = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MUTE_KEY, next ? '1' : '0')
    } catch {
      // The preference is lost on reload; the current session still honours it.
    }
  }
  if (next) stopTutorAmbient({ fadeMs: 0 })
  else if (ambientWanted) startTutorAmbient()
}

/** Play one platform UI sound. Re-plays from the start if already playing. */
export function playPlatformSound(name: PlatformSoundName): void {
  if (muted) return
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return
  const src = PLATFORM_SOUND_SRC[name]
  let el = cache.get(src)
  if (!el) {
    el = new Audio(src)
    el.preload = 'auto'
    cache.set(src, el)
  }
  // Volume is set on every play, not only at creation. The cache is keyed by
  // SRC and several names now share one asset at different levels, so a cached
  // element carries whatever the last caller wanted — `nav_tap` would leave
  // `tutor_chip` playing at the louder platform level, and vice versa.
  el.volume = TUTOR_SOUNDS.has(name) ? TUTOR_SOUND_VOLUME : PLATFORM_SOUND_VOLUME
  el.currentTime = 0
  playQuietly(el)
}

// ── The tutor's ambient bed ─────────────────────────────────────────────────
// One looping track under the whole session, quiet enough to be felt rather
// than heard, that DUCKS while anybody is talking: the learner's hold and the
// tutor's reply both pull it down and let it back up afterwards. One volume
// ramp is the difference between a soundscape that feels mixed and one that
// feels layered, and it is the only reason a bed under a speaking character is
// tolerable at all.

export const TUTOR_AMBIENT_SRC = '/sounds/edu/background.mp3'
/** Below the lesson BGM on purpose: nothing here is the subject. */
export const TUTOR_AMBIENT_VOLUME = 0.03
/** Where the bed sits while a voice has the floor. */
export const TUTOR_AMBIENT_DUCKED_VOLUME = 0.012

const DUCK_MS = 200
const RESTORE_MS = 600
const RAMP_STEP_MS = 25
const AMBIENT_FADE_MS = 3_000

let ambient: HTMLAudioElement | null = null
let ambientWanted = false
let ducked = false
let rampTimer: ReturnType<typeof setInterval> | null = null
let gestureRetry: (() => void) | null = null

function clearRamp(): void {
  if (rampTimer !== null) {
    clearInterval(rampTimer)
    rampTimer = null
  }
}

function clearGestureRetry(): void {
  if (gestureRetry && typeof window !== 'undefined') {
    window.removeEventListener('pointerdown', gestureRetry)
    window.removeEventListener('keydown', gestureRetry)
  }
  gestureRetry = null
}

/** Linear volume ramp on the bed. Nothing else in this file animates volume. */
function rampAmbientTo(target: number, durationMs: number): void {
  const el = ambient
  if (!el) return
  clearRamp()
  const steps = Math.max(1, Math.round(durationMs / RAMP_STEP_MS))
  const delta = (target - el.volume) / steps
  let remaining = steps
  rampTimer = setInterval(() => {
    remaining -= 1
    const next = remaining <= 0 ? target : el.volume + delta
    el.volume = Math.min(1, Math.max(0, next))
    if (remaining <= 0) clearRamp()
  }, RAMP_STEP_MS)
}

/**
 * Start the bed, arming it on the first gesture if autoplay refuses.
 *
 * The tutor route has a personalize step before the session begins, so by the
 * time this matters the learner has almost always tapped something. When they
 * have not, the retry hangs off the next pointer or key event anywhere in the
 * page rather than giving up silently for the whole session.
 */
export function startTutorAmbient(): void {
  ambientWanted = true
  if (muted) return
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return
  clearGestureRetry()
  if (!ambient) {
    ambient = new Audio(TUTOR_AMBIENT_SRC)
    ambient.loop = true
    ambient.preload = 'auto'
  }
  clearRamp()
  ambient.volume = ducked ? TUTOR_AMBIENT_DUCKED_VOLUME : TUTOR_AMBIENT_VOLUME

  // The bed is the one cue that gets a second chance, because it is the only
  // one whose moment does not pass: a one-shot the autoplay policy refused is
  // gone, but a loop can simply start late.
  const started: unknown = ambient.play()
  if (started instanceof Promise) {
    started.catch(() => {
      gestureRetry = () => {
        clearGestureRetry()
        if (ambientWanted && !muted && ambient?.paused) playQuietly(ambient)
      }
      window.addEventListener('pointerdown', gestureRetry, { once: true })
      window.addEventListener('keydown', gestureRetry, { once: true })
    })
  }
}

/** Fade the bed out. The close performance uses the default 3s. */
export function stopTutorAmbient(opts?: { fadeMs?: number }): void {
  ambientWanted = false
  ducked = false
  clearGestureRetry()
  const el = ambient
  if (!el || el.paused) return
  const fadeMs = opts?.fadeMs ?? AMBIENT_FADE_MS
  clearRamp()
  if (fadeMs <= 0) {
    el.pause()
    el.currentTime = 0
    el.volume = TUTOR_AMBIENT_VOLUME
    return
  }
  const steps = Math.max(1, Math.round(fadeMs / RAMP_STEP_MS))
  const step = el.volume / steps
  rampTimer = setInterval(() => {
    if (el.volume > step) {
      el.volume = Math.max(0, el.volume - step)
    } else {
      clearRamp()
      el.pause()
      el.currentTime = 0
      el.volume = TUTOR_AMBIENT_VOLUME
    }
  }, RAMP_STEP_MS)
}

/**
 * Duck the bed while a voice has the floor, or let it back up.
 *
 * Down fast and up slow on purpose: the drop has to beat the first syllable,
 * while the return should be something the learner never notices happening.
 */
export function duckTutorAmbient(next: boolean): void {
  if (ducked === next) return
  ducked = next
  if (!ambient || ambient.paused) return
  if (next) rampAmbientTo(TUTOR_AMBIENT_DUCKED_VOLUME, DUCK_MS)
  else rampAmbientTo(TUTOR_AMBIENT_VOLUME, RESTORE_MS)
}
