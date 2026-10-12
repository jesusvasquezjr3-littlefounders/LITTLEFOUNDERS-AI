import { useEffect, useId, useRef, type CSSProperties } from 'react';
import type { AnimationItem } from 'lottie-web';
import { ICON_ANIMATIONS, ICON_REST, ICON_SEGMENTS, ICON_SIZE, type IconLayer, type IconName } from '@/icons/rest';

/*
 * One of the application's own icons (D-054): a small picture in full color that is alive, kept as a Lottie file.
 * Every icon and symbol of the platform is drawn through this element; none comes from an icon library.
 *
 * What a person sees first is the icon's rest frame, plain SVG that is part of the page, so an icon never
 * arrives late or blank. The player and the icon's animation are fetched when the icon first has to move:
 *
 *   - `idle` loops while the icon is `alive`: a flame that burns, a house whose chimney smokes. An icon is alive
 *     when what it stands for is on: pass `alive`, or `active` (the current destination), which implies it;
 *   - `hover` plays once when a pointer enters, or the keyboard's focus reaches, the control the icon is in (the
 *     nearest button or link; give any other element `data-icon-host` to make it the one that answers);
 *   - `select` plays once when `active` becomes true.
 *
 * An icon that is off screen does not run. A person who asked for less motion gets the rest frame and nothing is
 * fetched. The icon is decorative unless it is given a `label`.
 *
 * To add or change an icon: tools/icons/definitions.mjs, then `npm run icons`.
 */
type Once = Exclude<keyof typeof ICON_SEGMENTS, 'idle'>;

const prefersLessMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** What a layer of the rest frame is painted with. A gradient is defined once, under an id of this icon's own. */
function paint(layer: IconLayer, gradient: string) {
  if (layer.ink === 'stroke') return { fill: 'none', stroke: 'currentColor', strokeWidth: layer.width, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  if (layer.ink === 'fill') return { fill: 'currentColor' };

  if (layer.stroke) return { fill: 'none', stroke: layer.stroke, strokeWidth: layer.width, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  return { fill: layer.gradient ? `url(#${gradient})` : layer.fill };
}

export function AppIcon({ name, size, active = false, alive = false, label, className = '', style }: { name: IconName; size?: number | string; active?: boolean; alive?: boolean; label?: string; className?: string; style?: CSSProperties }) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLSpanElement>(null);
  const player = useRef<AnimationItem | null>(null);
  // what the icon should be doing: kept in refs so the player's own events read the latest
  const isAlive = useRef(alive || active);
  const isSeen = useRef(true);
  const once = useRef<Once | null>(null);
  const isPlayingOnce = useRef(false);
  const isLoading = useRef(false);
  const wasActive = useRef(active);

  /** Plays what is due: a movement asked for once, or else the loop while the icon is alive and on screen. */
  const run = useRef(() => {
    const animation = player.current;

    if (!animation) return;

    const due = once.current;

    once.current = null;
    isPlayingOnce.current = due !== null;

    if (due) {
      animation.loop = false;
      animation.playSegments([...ICON_SEGMENTS[due]], true);
    } else if (isAlive.current && isSeen.current) {
      animation.loop = true;
      animation.playSegments([...ICON_SEGMENTS.idle], true);
    } else {
      animation.loop = false;
      animation.goToAndStop(0, true);
    }
  });

  const wake = useRef((segment: Once | null) => {
    if (prefersLessMotion()) return;

    // a movement that plays once is left to finish; only a selection may take its place
    if (isPlayingOnce.current && segment !== 'select') return;

    // a selection that is waiting is never replaced by a pointer passing over the icon
    if (segment && !(segment === 'hover' && once.current === 'select')) once.current = segment;

    if (player.current) {
      run.current();

      return;
    }

    if (isLoading.current) return;

    isLoading.current = true;

    void Promise.all([import('lottie-web/build/player/lottie_light'), ICON_ANIMATIONS[name]()]).then(([lottie, animation]) => {
      const container = stage.current;

      // the icon left the page while its animation was on the way
      if (!container || !root.current) return;

      player.current = lottie.default.loadAnimation({
        container, renderer: 'svg', loop: false, autoplay: false,
        // the player changes the data it is given, and several icons may share one file: each gets its own copy
        animationData: structuredClone(animation.default),
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
      });
      // when a movement that plays once ends, the icon goes back to its loop, or to rest
      player.current.addEventListener('complete', () => run.current());
      // from here on the player draws the icon; its first frame is the rest frame it replaces
      root.current.dataset.live = '1';
      run.current();
    }).catch(() => {
      // the rest frame stays: an icon that cannot move is still an icon
      isLoading.current = false;
    });
  });

  // the control the icon is in answers for it, and an icon that is off screen rests
  useEffect(() => {
    const element = root.current;
    const host = element?.closest<HTMLElement>('[data-icon-host], button, a, [role="button"], [role="tab"]') ?? element;

    if (!element || !host) return undefined;

    const onEnter = (event: PointerEvent) => { if (event.pointerType === 'mouse') wake.current('hover'); };

    const onFocus = () => { if (host.matches(':focus-visible')) wake.current('hover'); };

    const watch = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      isSeen.current = entry?.isIntersecting ?? true;

      if (isAlive.current) wake.current(null);
    });

    host.addEventListener('pointerenter', onEnter);

    host.addEventListener('focus', onFocus);

    watch?.observe(element);

    return () => {
      host.removeEventListener('pointerenter', onEnter);
      host.removeEventListener('focus', onFocus);
      watch?.disconnect();
    };
  }, []);

  useEffect(() => {
    isAlive.current = alive || active;

    const becameActive = active && !wasActive.current;

    wasActive.current = active;

    if (becameActive) wake.current('select');
    else if (isAlive.current || player.current) wake.current(null);
  }, [alive, active]);

  useEffect(() => () => {
    player.current?.destroy();
    player.current = null;
  }, []);

  return <span ref={root} className={`lf-icon ${className}`} data-icon={name} data-active={active || undefined} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={size === undefined ? style : { ...style, inlineSize: size, blockSize: size }}>
    <svg className="lf-icon-rest" viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`} focusable={false} aria-hidden>
      {ICON_REST[name].map((layer, index) => {
        const gradient = `${id}-${index}`;

        return <g key={index} transform={layer.transform} opacity={layer.opacity} {...paint(layer, gradient)}>
          {layer.gradient ? <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1={layer.gradient.from[0]} y1={layer.gradient.from[1]} x2={layer.gradient.to[0]} y2={layer.gradient.to[1]}>
            {layer.gradient.stops.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={String(color)} />)}
          </linearGradient> : null}
          {layer.figures.map((figure, at) => (figure.tag === 'path' ? <path key={at} {...figure.attrs} /> : figure.tag === 'circle' ? <circle key={at} {...figure.attrs} /> : figure.tag === 'ellipse' ? <ellipse key={at} {...figure.attrs} /> : <rect key={at} {...figure.attrs} />))}
        </g>;
      })}
    </svg>
    <span ref={stage} className="lf-icon-stage" />
  </span>;
}
