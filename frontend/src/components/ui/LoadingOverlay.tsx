interface LoadingOverlayProps {
  label?: string;
}

/*
 * The app's "still working" surface — and the first thing a cold visit paints,
 * since it is also the Suspense fallback for every lazy route.
 *
 * It used to render `<LottieIcon name="loading" />`, which mounts the
 * dotlottie player, which fetches 635 KB (brotli) of WebAssembly from
 * cdn.jsdelivr.net before it can draw a single frame. A spinner that costs
 * more than the screen it is covering — from a third party, on the critical
 * path, for every visitor — is the wrong trade. `.lf-spinner` is CSS
 * (index.css), so it animates in the first frame and ships no bytes.
 *
 * The Lottie icons that earn their keep (streak, gold coin, time) are
 * untouched: they appear after a lesson is finished, where the player's cost
 * is paid once and buys the celebration it is there for.
 */
export function LoadingOverlay({ label }: LoadingOverlayProps) {
  return (
    <div
      className="flex h-full min-h-[400px] w-full flex-col items-center justify-center gap-8 p-8"
      aria-live="polite"
      aria-busy="true"
    >
      {/* aria-hidden: the label below is what a screen reader should read.
          An unlabelled decorative ring would otherwise announce nothing. */}
      <span className="lf-spinner h-16 w-16" role="presentation" aria-hidden />
      {label && <p className="lf-title animate-pulse text-center text-content-muted">{label}</p>}
    </div>
  );
}
