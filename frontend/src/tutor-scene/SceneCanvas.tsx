import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useAdaptiveQuality } from './useAdaptiveQuality';
import type { QualitySettings, QualityTier } from './quality';
import './sceneCanvas.css';

export interface SceneStats {
  fps: number;
  tier: QualityTier;
  /** Draw calls in the last rendered frame — the number that actually predicts mobile cost. */
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
  /** True once the adaptive loop stopped trying to promote the tier. */
  locked: boolean;
}

export interface SceneCanvasProps {
  children: ReactNode;
  className?: string;
  /** Fired about once per second with live renderer counters. */
  onStats?: (stats: SceneStats) => void;
  /** Exposes the resolved settings so scene content can honour ambientMotion/shadows. */
  onSettings?: (settings: QualitySettings) => void;
  /**
   * Default camera. Must be set here and not as a `<perspectiveCamera>` child:
   * R3F only adopts a camera declared in the tree if it is explicitly marked as
   * the default, so a child camera silently renders from the origin instead.
   */
  camera?: { position?: [number, number, number]; fov?: number };
  /**
   * Whether this canvas may receive pointer events. Defaults to TRUE, so the
   * Tutor — which is driven by tapping the stage — is untouched.
   *
   * SET IT FALSE FOR ANY CANVAS THAT OVERLAYS THE PAGE, and know that a CSS
   * class on an ancestor is NOT enough. React Three Fiber writes
   * `pointer-events: auto` INLINE on its own container, which beats an
   * inherited `pointer-events: none` from a wrapper — so the character layer's
   * full-viewport canvas sat at z-20 and became the topmost element over every
   * control in the Lesson Engine. `document.elementFromPoint` on the "Start
   * lesson" button returned CANVAS, and the button did nothing.
   */
  interactive?: boolean;
}

/*
 * Lives INSIDE the Canvas because everything it touches (frame callbacks, the
 * renderer's info counters) only exists inside the R3F tree. It renders
 * nothing; it measures, governs, and reports.
 */
function Governor({
  onFrame,
  fps,
  tier,
  locked,
  onStats,
}: {
  onFrame: (delta: number) => void;
  fps: number;
  tier: QualityTier;
  locked: boolean;
  onStats?: (stats: SceneStats) => void;
}) {
  const { gl } = useThree();
  const lastReport = useRef(0);

  useFrame((_, delta) => {
    onFrame(delta);
    if (!onStats) return;

    // Report on the same ~1s cadence the governor measures on. Reporting per
    // frame would push a React state update 60×/second into the parent and
    // cost more than the scene it is measuring.
    lastReport.current += delta;
    if (lastReport.current < 1) return;
    lastReport.current = 0;

    onStats({
      fps,
      tier,
      locked,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      pixelRatio: gl.getPixelRatio(),
    });
  });

  return null;
}

/**
 * Renders only while the scene is both on screen and in a foreground tab.
 *
 * This is the single largest device-load lever in the whole system and it is
 * not an optimization — a WebGL canvas left spinning is a pegged GPU. On a
 * phone that is a hot device and a visibly draining battery while the child is
 * reading text somewhere else on the page.
 */
function useSceneActive(ref: React.RefObject<HTMLElement>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  const [foreground, setForeground] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  );

  useEffect(() => {
    const onVisibility = () => setForeground(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const el = ref.current;
    // IntersectionObserver is universally available in our supported browsers,
    // but if it ever is not, the honest failure is "always render" — never
    // "never render", which would be a blank scene rather than a warm phone.
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry?.isIntersecting ?? true), {
      threshold: 0.01,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  return onScreen && foreground;
}

export function SceneCanvas({ children, className, onStats, onSettings, camera, interactive = true }: SceneCanvasProps) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const active = useSceneActive(hostRef);
  const { settings, probe, fps, locked, onFrame } = useAdaptiveQuality();

  // A lost context leaves a permanently black canvas unless we ask for it back.
  // Mobile GPUs drop contexts routinely (backgrounding, memory pressure, driver
  // resets), so this is an expected event, not an exceptional one.
  const [contextEpoch, setContextEpoch] = useState(0);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    onSettings?.(settings);
  }, [settings, onSettings]);

  const handleCreated = useCallback(({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      // Without preventDefault the browser will not fire contextrestored, and
      // the canvas stays black forever.
      event.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
      setContextEpoch((n) => n + 1);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
  }, []);

  if (probe.webgl === 'none') {
    /*
     * The Tutor scene is 3D for every user by product decision. A device with
     * no WebGL context at all cannot render 3D by any implementation — this is
     * the physical floor, not a fallback tier. We say so plainly instead of
     * showing a black rectangle.
     */
    return (
      <div
        ref={hostRef}
        className={cn('lf-scene-notice', className)}
      >
        <p>{t('tutor.scene.webglUnavailable')}</p>
      </div>
    );
  }

  /*
   * `min-inline-size: 0` and the canvas cap (sceneCanvas.css) are what let this shrink, and both are load
   * bearing.
   *
   * R3F gives the <canvas> explicit width/height ATTRIBUTES, which is an
   * intrinsic size. A grid or flex item defaults to `min-width: auto`, meaning
   * it will not shrink below its content's min-content width — so once the
   * canvas had been sized at a wide viewport, the column could never get
   * narrower again. Growing a window worked; SHRINKING one left the canvas
   * stuck at its old width and pushed a horizontal scrollbar onto the page,
   * which /DESIGN.md and /AGENTS.md §1.11 forbid outright. It reproduced every
   * time: 1540 px viewport → 659 px left a 760 px canvas and a 780 px document.
   *
   * A phone rotating to portrait is the same event.
   */
  return (
    <div
      ref={hostRef}
      className={cn('lf-scene-host', !interactive && 'lf-scene-host--passive', className)}
    >
      <Canvas
        key={contextEpoch}
        camera={camera ?? { position: [3, 2, 4], fov: 45 }}
        /*
         * Passed as an inline STYLE, not a class: R3F sets
         * `pointer-events: auto` inline on this same element, and only another
         * inline value wins. See `interactive` above.
         */
        style={interactive ? undefined : { pointerEvents: 'none' }}
        // dpr is the single biggest fill-rate lever: [floor, ceiling]. The
        // ceiling moves with the tier, so a struggling device renders fewer
        // pixels rather than losing scene content.
        dpr={[Math.min(1, settings.renderScale), settings.maxPixelRatio * settings.renderScale]}
        /*
         * `'percentage'` — PCFShadowMap — NOT `true`, which is PCFSoftShadowMap.
         *
         * This version of three has deprecated PCFSoftShadowMap and silently
         * substitutes PCFShadowMap for it, so `shadows={true}` asked for a mode
         * the renderer will not give and got the hard one anyway. Naming the
         * mode we are actually rendering with is the honest half.
         *
         * The other half is the noise it was making. Traced from a live
         * production session on 2026-09-12 by patching `console.warn` and
         * keeping the stack: the deprecation is logged from inside
         * `WebGLShadowMap.render`, in r3f's frame loop — not from React
         * re-applying a prop, which is what it looked like from the outside —
         * so every shadow pass wrote a line. About one a second during a
         * session, none once it closed; roughly 10,000 messages in a long one,
         * enough to overflow the console buffer and take every other warning
         * with it. A console a person has stopped reading is the failure the
         * message itself was trying to prevent.
         */
        shadows={settings.shadows ? 'percentage' : false}
        frameloop={active ? 'always' : 'never'}
        /*
         * `preserveDrawingBuffer` IN DEV ONLY, so the stage can be screenshotted.
         *
         * /AGENTS.md §1.11 requires every UI change to be verified in-browser at
         * 375 px and 1280 px WITH SCREENSHOTS, and on this project looking has
         * repeatedly found what the tests missed. Without this flag WebGL clears
         * the drawing buffer on composite, so `canvas.toDataURL()` returns a
         * blank white image and there is no way to capture the one surface that
         * most needs looking at — which is exactly what happened: four engineers
         * in a row reported "I could not see it".
         *
         * It stays out of production because it forces the renderer to keep a
         * second copy of the frame, which costs memory and fill rate on the
         * low-end devices the quality tiers exist to protect.
         */
        gl={{
          /*
           * MSAA IS FIXED FOR THE LIFE OF THE CONTEXT, so this reads the
           * INITIAL tier and the governor can never change it.
           *
           * That is not a limitation being worked around, it is a WebGL fact:
           * `antialias` is a context-creation attribute. The governor's
           * `antialias: false` on the low tier was therefore a no-op — and
           * since every touch device starts at `medium` (pickInitialTier caps
           * coarse pointers there) and medium had it on, every phone carried
           * MSAA for the whole session while the governor believed it had
           * turned it off. Fill rate is exactly what those devices lack.
           *
           * Recreating the context to apply it would remount the canvas and
           * refetch the island — the learner watches their world blink — so
           * the decision is made ONCE, honestly, from the device rather than
           * from a tier that can move: MSAA only where it is affordable.
           * Everything adaptive happens through `dpr`, which R3F does apply
           * live.
           */
          antialias: settings.antialias && !probe.coarsePointer,
          powerPreference: 'high-performance',
          alpha: true,
          preserveDrawingBuffer: import.meta.env.DEV,
        }}
        onCreated={handleCreated}
      >
        <Governor onFrame={onFrame} fps={fps} tier={settings.tier} locked={locked} onStats={onStats} />
        {children}
      </Canvas>
      {contextLost ? (
        <div className="lf-scene-notice lf-scene-notice--over">
          <p>{t('tutor.scene.contextLost')}</p>
        </div>
      ) : null}
    </div>
  );
}
