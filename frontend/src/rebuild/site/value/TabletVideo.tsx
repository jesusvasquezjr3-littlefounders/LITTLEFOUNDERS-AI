import { useEffect, useRef, useState } from 'react';
import { useStillOnly } from '../hero/HeroVideo';

/*
 * The tablet's screen on the landing: the still of the app's screen paints at once (it is also what stays for reduced motion,
 * less data, or a browser that refuses to play), and the active card's clip plays over it: someone using that screen, with a
 * cursor (scripts/render-site-tablet-video.mjs). It is the app's own screen driven by real clicks, not a drawing.
 *
 *  - Muted, hidden from assistive technology, looping, and never a sound.
 *  - Only the active card's clip is loaded; the others stay as stills.
 *  - It plays only while on screen and starts from the first frame each time its card opens.
 */
const BASE = '/rebuild/landing/tablet';

export function TabletClip({ view, locale, theme, active }: { view: string; locale: string; theme: string; active: boolean }) {
  const still = useStillOnly();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const name = `tablet-${view}-${locale}-${theme}`;

  useEffect(() => {
    setPlaying(false);
    const element = video.current;
    if (!element || !active || typeof IntersectionObserver === 'undefined') return;
    element.currentTime = 0;
    const watch = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void element.play().catch(() => {});
      else element.pause();
    }, { threshold: 0.25 });
    watch.observe(element);
    return () => watch.disconnect();
  }, [active, name, still]);

  if (still || !active) return null;
  return <video key={name} ref={video} className="lf-value-clip" poster={`${BASE}/${name}.webp`} width={1280} height={960} muted loop playsInline preload="auto"
    aria-hidden="true" disablePictureInPicture data-playing={playing} onPlaying={() => setPlaying(true)} data-asset-id={`site.landing.tablet.${view}.${locale}.${theme}.clip`}>
    <source src={`${BASE}/${name}.mp4`} type="video/mp4" />
  </video>;
}
