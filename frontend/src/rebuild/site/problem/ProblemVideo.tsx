import { useEffect, useRef } from 'react';
import { useRebuildEnvironment } from '../../design/layers';
import { useStillOnly } from '../hero/HeroVideo';

/*
 * The problem section's picture: Liruf and Dina with seeds and small things about learning circling them in a loop, rendered from the
 * real 3D scene (scripts/render-problem-video.mjs, the hero's method with another cast). Two colour modes, each its own file, drawn on
 * the page's own background colour and faded at its edges, so it has no frame. The poster paints at once and stays for reduced motion
 * or less data. Muted, hidden from assistive technology, started and paused by visibility, never a sound.
 */
const BASE = '/rebuild/landing/problem';

export function ProblemVideo({ className }: { className?: string }) {
  const { theme } = useRebuildEnvironment();
  const still = useStillOnly();
  const video = useRef<HTMLVideoElement>(null);
  const poster = `${BASE}/problem-${theme}-poster.webp`;

  useEffect(() => {
    const element = video.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const watch = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void element.play().catch(() => {});
      else element.pause();
    }, { threshold: 0.1 });
    watch.observe(element);
    return () => watch.disconnect();
  }, [theme, still]);

  if (still) return <img className={className} src={poster} alt="" width={1000} height={800} decoding="async" />;
  return <video key={theme} ref={video} className={className} poster={poster} width={1000} height={800} muted loop playsInline preload="auto"
    aria-hidden="true" disablePictureInPicture>
    <source src={`${BASE}/problem-${theme}.mp4`} type="video/mp4" />
  </video>;
}
