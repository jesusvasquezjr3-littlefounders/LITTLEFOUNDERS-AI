import { useEffect, useRef } from 'react';

/*
 * Plays the current roleplay beat's pre-generated clip and reports when it
 * ends — the whole component, on purpose.
 *
 * NO `crossOrigin`/Web-Audio DANCE, UNLIKE `TutorStage.tsx`'s OWN speech
 * element. That element routes audio through `createMediaElementSource` for
 * `useLipSync`'s viseme analysis, which taints a cross-origin element with
 * no CORS approval into digital silence — the exact production outage
 * `TutorStage.tsx`'s own header documents. This element does neither: no
 * lip-sync is wired for roleplay yet (`useRoleplayDirector.ts`'s own header
 * on why), so nothing here ever calls Web Audio on it, and a plain `<audio>`
 * plays a cross-origin `src` correctly with no CORS involvement at all —
 * the taint only exists for code that tries to ANALYSE the samples, never
 * for code that only plays them.
 */
export function RoleplayAudio({ url, onEnded }: { url: string | null; onEnded: () => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    const node = audio.current;
    if (!node || !url || url === lastUrl.current) return;
    lastUrl.current = url;
    node.currentTime = 0;
    // Autoplay can be refused (no prior gesture); the fallback timer in
    // `useRoleplayDirector.ts` is exactly what keeps the scene moving when
    // that happens, so a rejected `play()` is left silent here on purpose —
    // the caption alone already carries the line either way.
    void node.play().catch(() => {});
  }, [url]);

  return <audio ref={audio} src={url ?? undefined} preload="auto" onEnded={onEnded} />;
}
