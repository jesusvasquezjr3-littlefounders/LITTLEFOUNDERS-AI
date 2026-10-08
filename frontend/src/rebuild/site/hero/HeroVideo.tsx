import { useEffect, useRef, useState } from 'react';
import { useRebuildEnvironment } from '../../design/controls';

/*
 * The hero's picture: a short looping video of the Mentors and their orbiting
 * props, rendered from the real 3D scene (scripts/render-hero-video.mjs). A
 * video is the right weight for a decorative loop: every phone decodes it in
 * hardware, it costs the page no GPU work of its own, and it needs no
 * JavaScript scene at all.
 *
 *  - Two colour modes, each its own file, on the page's own background colour.
 *  - One H.264 MP4: every browser and phone decodes it in hardware. (A VP9 WebM of the same frames came out larger
 *    with the encoder available here, so it is not shipped.)
 *  - The poster paints at once, and stays when the visitor asks for reduced
 *    motion or for less data, or when the browser refuses to autoplay.
 *  - It pauses while off screen, so it never decodes unseen frames.
 */

const BASE = '/rebuild/landing/hero';

export function useStillOnly() {
  const [still, setStill] = useState(() => {
    if (typeof window.matchMedia !== 'function') return false;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(prefers-reduced-data: reduce)').matches || connection?.saveData === true;
  });
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setStill(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return still;
}

export function HeroVideo() {
  const { theme } = useRebuildEnvironment();
  const still = useStillOnly();
  const video = useRef<HTMLVideoElement>(null);
  const poster = `${BASE}/hero-${theme}-poster.webp`;

  useEffect(() => {
    const element = video.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const watch = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void element.play().catch(() => {});
      else element.pause();
    }, { threshold: 0.05 });
    watch.observe(element);
    return () => watch.disconnect();
  }, [theme, still]);

  if (still) return <img className="lf-hero-media" src={poster} alt="" width={1000} height={800} decoding="async" data-asset-id={`site.landing.hero.${theme}`} />;
  return <video key={theme} ref={video} className="lf-hero-media" poster={poster} width={1000} height={800} autoPlay muted loop playsInline preload="auto"
    aria-hidden="true" disablePictureInPicture data-asset-id={`site.landing.hero.${theme}`}>
    <source src={`${BASE}/hero-${theme}.mp4`} type="video/mp4" />
  </video>;
}
