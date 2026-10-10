import { useEffect, type CSSProperties } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useCoreCopy } from '@/i18n/useCopy';
import { useTheme } from '@/theme/useTheme';

/*
 * What a window shows while something inside the platform is loading: a progress bar that fills from empty to 80 % in
 * two seconds and holds there, so the wait feels short, with a character running on the bar's leading edge (and
 * running in place while it holds). When the work is done (`done`) the bar goes on to 100 % and `onFinished` fires.
 * It is the content of a window with the same surface as the sign-in window (Cojeev's Dialog), and carries no
 * percentage; the runner has no cast shadow, because it stands on a bar. The word under the bar is a locale key, set in bold capitals with 10 % letter-spacing (CSS `uppercase`, so
 * the translators write it normally and a screen reader reads it normally).
 *
 * The runner is an AVIF sprite sheet (docs/engineering/FRONTEND-GUIDE.md, "The loading window"): 12 frames side by
 * side, drawn at twice the size they are shown (a 2x screen), one sheet per character and per color mode in
 * `public/loading/`. The frames step through a CSS transform (`.lf-run` in lf-theme.css): a still image decoded once,
 * no animation decoder. With reduced motion the bar jumps to its place and the runner stands on the first frame.
 */
export type Runner = 'rho' | 'zara' | 'liruf' | 'dina';

/** One frame in CSS pixels, per character; the sheet is twice this wide per frame. */
const FRAME: Record<Runner, readonly [number, number]> = { rho: [55, 94], zara: [72, 101], liruf: [80, 86], dina: [107, 82] };

const FRAMES = 12;

const HOLD = 0.8;

const TRACK = 12;

export function LoadingWindow({ runner, done = false, onFinished }: { runner: Runner; done?: boolean; onFinished?: () => void }) {
  const label = useCoreCopy().appShell.loading;
  const { isDark } = useTheme();
  const reduced = useReducedMotion();
  const progress = useMotionValue(0);
  const width = useTransform(progress, (value) => `${value * 100}%`);
  // at 0 the window is empty: the runner steps in as the bar starts
  const presence = useTransform(progress, [0, 0.05], [0, 1]);
  const [frameWidth, frameHeight] = FRAME[runner];

  // Fill to 80 % and hold.
  useEffect(() => {
    if (reduced) {
      progress.set(HOLD);

      return;
    }

    const run = animate(progress, HOLD, { duration: 2, ease: [0.25, 0.9, 0.35, 1] });

    return () => run.stop();
  }, [progress, reduced]);

  // When the work is done, finish the bar.
  useEffect(() => {
    if (!done) return;

    const run = animate(progress, 1, { duration: reduced ? 0 : 0.2, ease: 'easeOut', onComplete: onFinished });

    return () => run.stop();
  }, [done, onFinished, progress, reduced]);

  // SAFETY: `--lf-frames` and `--lf-frame` are custom properties, which CSSProperties does not list; both are plain numbers and pixel lengths read only by `.lf-run` in lf-theme.css.
  const runnerStyle = { width: frameWidth, height: frameHeight, bottom: TRACK - 4, '--lf-frames': FRAMES, '--lf-frame': `${frameWidth}px` } as CSSProperties;

  return <div role="status" className="grid gap-3 px-6 pt-5 pb-6 text-center">
    <div className="relative" style={{ height: frameHeight + TRACK - 4 }}>
      <div className="absolute inset-x-0 bottom-0 h-3 overflow-hidden rounded-full bg-[var(--v-beige-2)] shadow-[inset_0_0_0_1px_var(--v-border)]">
        <motion.div className="h-full rounded-full bg-[var(--primary)]" style={{ width }} />
      </div>
      <motion.div className="absolute bottom-0 start-0" style={{ width, height: 0, opacity: presence }}>
        <div className="lf-run absolute end-0 translate-x-1/2 overflow-hidden" style={runnerStyle}>
          <img src={`/loading/${runner}-${isDark ? 'dark' : 'light'}.avif`} alt="" width={frameWidth * FRAMES} height={frameHeight} draggable={false} className="block max-w-none" />
        </div>
      </motion.div>
    </div>
    <p className="m-0 text-[length:var(--fs-small)] font-extrabold tracking-[0.1em] text-[var(--v-text)] uppercase">{label}</p>
  </div>;
}
