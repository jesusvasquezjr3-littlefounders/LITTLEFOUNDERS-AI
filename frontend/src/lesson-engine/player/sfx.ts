// Lesson-player sound effects — tiny, dependency-free. Assets live in
// /public/sfx (app chrome, generated once with ElevenLabs sound-generation —
// see the repo memory: ElevenLabs is for SOUND EFFECTS ONLY; narration/TTS is
// qwen3-tts via Echo). Fire-and-forget: SFX must never block or interrupt the
// narration Audio element (separate instances), and autoplay rejections are
// swallowed — a missing sound is never an error a kid sees.

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

const VOLUME: Record<SfxName, number> = {
  correct: 0.5,
  perfect: 0.55,
  tryagain: 0.4, // gentler than the win sounds — kind, never punishing
  celebration: 0.55,
  streak: 0.5,
  flip: 0.35,
  match: 0.45,
  drop: 0.35,
  hint: 0.45,
}

const cache = new Map<SfxName, HTMLAudioElement>()

/** Play one UI sound. Re-plays from the start if already playing. */
export function playSfx(name: SfxName): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return
  let el = cache.get(name)
  if (!el) {
    el = new Audio(`/sfx/${name}.mp3`)
    el.preload = 'auto'
    el.volume = VOLUME[name]
    cache.set(name, el)
  }
  el.currentTime = 0
  void el.play().catch(() => {
    // Autoplay policy or missing asset — silently skip; sound is enhancement,
    // never a requirement.
  })
}
