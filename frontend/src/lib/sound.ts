// Platform-wide UI sounds — the original v1 LittleFounders set (rescued from
// v1 `main` @ f4d09ad, /public/sounds), at v1's audible level: one-shots
// played at Howler instance volume 0.15 under the global Howler.volume(0.5)
// master, so the effective product 0.15 × 0.5 = 0.075 is set directly here.
// v1 contexts (SoundContext call sites): auth_success on login/signup/OAuth
// success, auth_error on those failures, auth_bye on logout (TopNav), and
// nav taps reused the ui tap asset (nav_slide → tap.mp3). Same fire-and-forget
// contract as the lesson player's sfx.ts: autoplay rejections and missing
// assets are swallowed — sound is enhancement, never a requirement.

export type PlatformSoundName = 'auth_success' | 'auth_error' | 'auth_bye' | 'nav_tap'

/** v1 one-shot audible level: instance 0.15 × Howler master 0.5. */
export const PLATFORM_SOUND_VOLUME = 0.075

export const PLATFORM_SOUND_SRC: Record<PlatformSoundName, string> = {
  auth_success: '/sounds/auth/success.mp3',
  auth_error: '/sounds/auth/error.mp3',
  auth_bye: '/sounds/auth/bye.mp3',
  nav_tap: '/sounds/ui/tap.mp3',
}

const cache = new Map<string, HTMLAudioElement>()

/** Play one platform UI sound. Re-plays from the start if already playing. */
export function playPlatformSound(name: PlatformSoundName): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return
  const src = PLATFORM_SOUND_SRC[name]
  let el = cache.get(src)
  if (!el) {
    el = new Audio(src)
    el.preload = 'auto'
    el.volume = PLATFORM_SOUND_VOLUME
    cache.set(src, el)
  }
  el.currentTime = 0
  void el.play().catch(() => {
    // Autoplay policy or missing asset — silently skip.
  })
}
