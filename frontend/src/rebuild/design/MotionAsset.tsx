import { lazy, Suspense, useCallback, useEffect, useState, type ComponentType } from 'react';
import { resolveManifestAsset } from './assets';
import { useCelebrationState } from './motion';

/*
 * A celebration motion asset (Frontend Bible 07 §5, 04; OD-7; OD-28 V-12).
 *
 * It shows one manifest-registered Lottie of the `celebration-motion` family,
 * by id only, and only inside a milestone `Celebration` on the closed OD-7
 * list: outside one, or inside a refused one, it renders nothing, so no
 * celebration asset can play anywhere else (07 §5 "play only on the D7
 * milestone list"). While that celebration plays, the Lottie plays once (never
 * a loop) through the bundled player, whose code and WebAssembly are loaded
 * only then and served from this app, never from a CDN; once started it runs
 * to its end and holds its last frame. Reduced motion, a revisit, and a moment
 * that settled before the player could start show the asset's designated
 * static frame (07 §5), an SVG drawn as the animation's last frame, so nothing
 * jumps. If the player cannot load, the static frame is shown instead.
 * Always decorative: hidden from assistive tech, never interactive, no text.
 */

type MediaProps = { src: string; still: string; className: string; onStart?: () => void };

function Still({ still, className }: MediaProps) {
  return <img className={className} src={still} alt="" aria-hidden="true" data-motion-frame="static" />;
}

const Player = lazy(async (): Promise<{ default: ComponentType<MediaProps> }> => {
  try {
    const [{ DotLottieReact, setWasmUrl }, wasm] = await Promise.all([
      import('@lottiefiles/dotlottie-react'),
      import('@lottiefiles/dotlottie-web/dotlottie-player.wasm?url'),
    ]);
    setWasmUrl(wasm.default);
    return { default: function Played({ src, className, onStart }: MediaProps) {
      useEffect(() => { onStart?.(); }, [onStart]);
      return <DotLottieReact className={className} src={src} autoplay loop={false} data-motion-frame="playing" />;
    } };
  } catch {
    return { default: Still };
  }
});

export function MotionAsset({ assetId, className }: { assetId: string; className?: string }) {
  const state = useCelebrationState();
  // The player started while the celebration played: it finishes its one run even after the moment settles.
  const [started, setStarted] = useState(false);
  const onStart = useCallback(() => setStarted(true), []);
  const asset = resolveManifestAsset(assetId);
  if (!asset || asset.type !== 'lottie' || !asset.staticFrame || asset.reviewFamily !== 'celebration-motion') return null;
  if (state === null || state === 'refused') return null;
  const play = state === 'playing' || (state === 'settled' && started);
  const media = { src: asset.path, still: asset.staticFrame, className: 'lf-motion-asset-media' };
  return <span className={`lf-motion-asset${className ? ` ${className}` : ''}`} aria-hidden="true" data-asset-id={asset.id} data-slot={asset.slot}>
    {play ? <Suspense fallback={null}><Player {...media} onStart={onStart} /></Suspense> : <Still {...media} />}
  </span>;
}

