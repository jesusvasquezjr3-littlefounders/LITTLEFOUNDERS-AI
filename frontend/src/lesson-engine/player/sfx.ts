// Lesson-player sound effects — tiny, dependency-free. Assets are the original
// v1 LittleFounders sound set (rescued from v1 `main` @ f4d09ad,
// /public/sounds), re-implemented at v1's AUDIBLE levels: v1 played one-shots
// through Howler at instance volume 0.15 under a global Howler.volume(0.5)
// master (SoundContext.tsx), so the audible product is 0.15 × 0.5 = 0.075.
// The lesson background loop played at 0.3 × 0.5 = 0.15. HTMLAudioElement has
// no master bus, so those effective products are set directly here — do not
// "restore" the raw 0.15/0.3 numbers, they would be twice as loud as v1.
// Fire-and-forget: SFX must never block or interrupt the narration Audio
// element (separate instances), and autoplay rejections are swallowed — a
// missing sound is never an error a kid sees.

export type SfxName =
  | 'correct'
  | 'perfect'
  | 'tryagain'
  | 'celebration'
  | 'streak'
  | 'flip'
  | 'match'
  | 'drop'
  | 'hint'

/** v1 one-shot audible level: instance 0.15 × Howler master 0.5. */
export const SFX_VOLUME = 0.075

// v1 context mapping (SoundContext SOUND_MAP + LessonRunner/activities usage):
// correct answers played edu_success, wrong answers edu_error (replaced by
// the neutral tap in S05.3f, B.26), lesson
// completion edu_complete, and EVERY in-activity interaction (select, drag,
// drop, flip) played ui_tap. v1's lesson engine had no streak moment; its
// games used the combo asset for perfect streaks, so streak maps there.
// unlock.mp3 is byte-identical to success.mp3 and is deliberately not mapped.
export const SFX_SRC: Record<SfxName, string> = {
  correct: '/sounds/edu/success.mp3',
  perfect: '/sounds/edu/success.mp3',
  // B.26 (S05.3f): a miss is not an error. The v1 "edu_error" buzzer encoded a
  // wrong answer as a failure sound; a not-yet answer now gets the neutral
  // interaction tap, and the cross and the hint banner carry the information.
  tryagain: '/sounds/ui/tap.mp3',
  celebration: '/sounds/edu/lesson_complete.mp3',
  streak: '/sounds/edu/combo.mp3',
  flip: '/sounds/ui/tap.mp3',
  match: '/sounds/ui/tap.mp3',
  drop: '/sounds/ui/tap.mp3',
  hint: '/sounds/ui/tap.mp3',
}

// Cached per src, not per name — several names share one asset (v1 cached
// Howl instances the same way), and re-triggering restarts the clip.
const cache = new Map<string, HTMLAudioElement>()

/** Play one UI sound. Re-plays from the start if already playing. */
export function playSfx(name: SfxName): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return
  const src = SFX_SRC[name]
  let el = cache.get(src)
  if (!el) {
    el = new Audio(src)
    el.preload = 'auto'
    el.volume = SFX_VOLUME
    cache.set(src, el)
  }
  el.currentTime = 0
  void el.play().catch(() => {
    // Autoplay policy or missing asset — silently skip; sound is enhancement,
    // never a requirement.
  })
}

// ── Lesson background music ──────────────────────────────────────────────────
// v1 looped /sounds/edu/background.mp3 for the whole lesson (LessonRunner:
// play on start/restart, stopBGM({ fade: true, fadeDuration: 1500 }) on
// completion and on unmount). Same lifecycle here, same audible level.

export const BGM_SRC = '/sounds/edu/background.mp3'
/** v1 lesson BGM audible level: playBGM volume 0.3 × Howler master 0.5. */
export const BGM_VOLUME = 0.15
const BGM_FADE_MS = 1500

let bgm: HTMLAudioElement | null = null
let fadeTimer: ReturnType<typeof setInterval> | null = null
let retryOnGesture: (() => void) | null = null

function clearFade(): void {
  if (fadeTimer !== null) {
    clearInterval(fadeTimer)
    fadeTimer = null
  }
}

function clearGestureRetry(): void {
  if (retryOnGesture) {
    window.removeEventListener('pointerdown', retryOnGesture)
    retryOnGesture = null
  }
}

/** Start (or restart) the looped lesson background track. */
export function playLessonBgm(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return
  clearFade()
  clearGestureRetry()
  if (!bgm) {
    bgm = new Audio(BGM_SRC)
    bgm.loop = true
    bgm.preload = 'auto'
  }
  bgm.volume = BGM_VOLUME
  void bgm.play().catch(() => {
    // Autoplay policy blocks a no-gesture start (lesson mount). v1's Howler
    // BGM had the same limitation; retry once on the kid's first tap so the
    // music still arrives instead of staying silent for the whole lesson.
    retryOnGesture = () => {
      clearGestureRetry()
      if (bgm && bgm.paused && fadeTimer === null) void bgm.play().catch(() => {})
    }
    window.addEventListener('pointerdown', retryOnGesture, { once: true })
  })
}

/** Stop the background track, fading out like v1 (1500 ms) unless fadeMs: 0. */
export function stopLessonBgm(opts?: { fadeMs?: number }): void {
  clearGestureRetry()
  if (!bgm || bgm.paused) return
  const fadeMs = opts?.fadeMs ?? BGM_FADE_MS
  clearFade()
  if (fadeMs <= 0) {
    bgm.pause()
    bgm.currentTime = 0
    bgm.volume = BGM_VOLUME
    return
  }
  const el = bgm
  const stepMs = 50
  const step = el.volume / Math.max(1, fadeMs / stepMs)
  fadeTimer = setInterval(() => {
    if (el.volume > step) {
      el.volume = Math.max(0, el.volume - step)
    } else {
      clearFade()
      el.pause()
      el.currentTime = 0
      el.volume = BGM_VOLUME
    }
  }, stepMs)
}
