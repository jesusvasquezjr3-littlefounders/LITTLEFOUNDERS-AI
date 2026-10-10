import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/theme/useTheme';

/*
 * A decorative looping video of the Mentors and their props, rendered from the
 * real 3D scene (scripts/render-*-video.mjs). A video is the right weight for a
 * decorative loop: every phone decodes it in hardware, it costs the page no GPU
 * work of its own, and it needs no JavaScript scene.
 *
 *  - Two colour modes, each its own file, drawn on the page's own background.
 *  - One H.264 MP4: every browser and phone decodes it in hardware.
 *  - The poster paints at once, and stays when the visitor asks for reduced
 *    motion or for less data, or when the browser refuses to autoplay.
 *  - It pauses while off screen, so it never decodes unseen frames, and a scene below the fold
 *    downloads nothing but its poster until the visitor scrolls near it.
 *  - Muted, hidden from assistive technology, never a sound.
 */

/** True when the visitor asked for reduced motion or less data: show the poster only. */
function useStillOnly() {
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

/** Delivered pixel size of each scene (the tools in tools/render/ produce exactly this). */
const SCENE_SIZE = { hero: { width: 1000, height: 800 }, problem: { width: 1500, height: 900 }, signin: { width: 1440, height: 420 }, notfound: { width: 1600, height: 680 } } as const;

/** `priority` is for the scene above the fold (it loads at once); every other scene waits until the visitor scrolls near it. */
export function LoopVideo({ name, className, priority = false }: { name: keyof typeof SCENE_SIZE; className?: string; priority?: boolean }) {
  const { isDark } = useTheme();
  const mode = isDark ? 'dark' : 'light';
  const still = useStillOnly();
  const video = useRef<HTMLVideoElement>(null);
  const base = `/landing/${name}`;
  const poster = `${base}/${name}-${mode}-poster.webp`;
  const { width, height } = SCENE_SIZE[name];

  useEffect(() => {
    const element = video.current;

    if (!element || typeof IntersectionObserver === 'undefined') return;

    const watch = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void element.play().catch(() => {});
      else element.pause();
    }, { threshold: 0.05 });

    watch.observe(element);

    return () => watch.disconnect();
  }, [mode, still]);

  if (still) return <img className={className} src={poster} alt="" width={width} height={height} decoding="async" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} />;

  return <video key={mode} ref={video} className={className} poster={poster} width={width} height={height} autoPlay muted loop playsInline preload={priority ? 'auto' : 'none'}
    aria-hidden="true" disablePictureInPicture>
    <source src={`${base}/${name}-${mode}.mp4`} type="video/mp4" />
  </video>;
}
