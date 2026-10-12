import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { LoadingWindow, type Runner } from '@/components/LoadingWindow';

/*
 * The loading window open on top of the page, for looking at it: `/dev/loading?runner=rho|zara|liruf|dina`, only in the
 * dev server (App.tsx does not mount it in a production build). `&frame=N` holds the runner on one frame, `&finish=S` finishes the bar after S seconds. A tool, not a product screen, so its labels are not in
 * the locale files.
 *
 * A loading window has nothing to press, so the window does not take focus when it opens: Radix would otherwise focus it
 * and the dialog's brand focus ring would draw a thick outline around a window that should feel quiet.
 */
const RUNNERS: readonly Runner[] = ['rho', 'zara', 'liruf', 'dina'];

function chosen(): Runner {
  const value = new URLSearchParams(window.location.search).get('runner');

  return RUNNERS.find((runner) => runner === value) ?? 'rho';
}

/** `&frame=N` holds the runner on frame N of its stride, for a still. */
function held(): string | null {
  const frame = Number(new URLSearchParams(window.location.search).get('frame'));

  return Number.isInteger(frame) && frame >= 0 && frame < 12 ? `.lf-run > img { animation-play-state: paused; animation-delay: -${(frame / 12) * 0.6}s; }` : null;
}

/** `&finish=S` tells the window the work is done after S seconds, to see the bar go on to 100 %. */
function finishAfter(): number {
  return Number(new URLSearchParams(window.location.search).get('finish')) || 0;
}

export default function DevLoading() {
  const hold = held();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const seconds = finishAfter();

    if (!seconds) return;

    const timer = setTimeout(() => setDone(true), seconds * 1000);

    return () => clearTimeout(timer);
  }, []);

  return <Dialog open>
    {hold ? <style>{hold}</style> : null}
    <DialogContent className="!w-[min(380px,calc(100%-32px))] !gap-0 overflow-hidden !p-0 text-center focus:!outline-none focus-visible:!outline-none" onOpenAutoFocus={(event) => event.preventDefault()}>
      <DialogTitle className="sr-only">Loading</DialogTitle>
      <DialogDescription className="sr-only">The loading window, for development.</DialogDescription>
      <LoadingWindow runner={chosen()} done={done} />
    </DialogContent>
  </Dialog>;
}
