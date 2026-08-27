/*
 * Device capability probing and quality tiering for the Tutor's 3D scene.
 *
 * WHY THIS EXISTS: the owner's mandate is that the Tutor scene is 3D for
 * EVERY user — not 3D for the users with good hardware and a 2D fallback for
 * the rest. That makes "does this device cope?" a runtime question we have to
 * answer continuously, not a capability gate we answer once at the door.
 *
 * The design has two halves, and the split is the whole point:
 *
 *   1. A STATIC PRIOR (`probeDevice` + `pickInitialTier`) — cheap, synchronous,
 *      and only used to avoid a bad first second. It is a guess.
 *   2. MEASURED FRAME TIME (`useAdaptiveQuality`) — the actual authority. A
 *      device that reports 8 cores and then renders at 22fps IS a low-tier
 *      device, whatever it claimed.
 *
 * Never invert that relationship. Vendor/renderer strings are deliberately not
 * consulted: `WEBGL_debug_renderer_info` is masked or generic in current
 * Safari and Firefox for fingerprinting reasons, so a tier derived from it
 * would be confidently wrong on exactly the browsers we most need to serve.
 */

export const QUALITY_TIERS = ['low', 'medium', 'high'] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];

export interface QualitySettings {
  tier: QualityTier;
  /** Hard ceiling on renderer pixel ratio. The single biggest fill-rate lever. */
  maxPixelRatio: number;
  antialias: boolean;
  shadows: boolean;
  /** Texture anisotropic filtering cap. 1 = off. */
  anisotropy: number;
  /**
   * Whether idle/ambient character motion runs. Distinct from
   * `prefers-reduced-motion`: this one is a performance decision, that one is
   * an accessibility instruction. Both can independently disable motion.
   */
  ambientMotion: boolean;
  /**
   * The user asked for less motion, as an accessibility instruction.
   *
   * Separate from `ambientMotion` on purpose, and the separation was earned:
   * that flag folds the accessibility instruction INTO a performance tier, so a
   * consumer reading it cannot tell "this phone is slow" from "this person gets
   * motion sickness". The two deserve different answers. Decoration — the
   * breathing idle — is right to stop for either. Motion that carries
   * INFORMATION, like which character is currently speaking, should stop only
   * for the accessibility instruction: silencing it on a cheap device removes
   * the signal exactly where most learners are, and it costs two quaternion
   * multiplies a frame.
   */
  reducedMotion: boolean;
  /**
   * Whether the HUD's material keeps its `backdrop-filter` (/DESIGN.md §Lumen).
   *
   * The only setting here that costs the COMPOSITOR rather than the renderer,
   * and the only one measured outside three.js. Profiled 2026-08-22 on the
   * target Intel UHD at a phone's pixel count: up to three extra compositor render
   * passes and ~0.5 ms of presented frame time — 3-8% of throughput. Cheap
   * there, and deliberately still switched off on `low`, for two reasons the
   * profile itself supplies. The cost is flat against blur radius and blurred
   * area, so it is per-PASS overhead, so there is no cheaper middle setting to
   * offer and the lever is binary. And on a fill-rate-starved rasterizer (the
   * pessimistic bracket in that profile) it is 9% of a frame that is already
   * missing its budget — spent on softening a backdrop the device is barely
   * drawing.
   *
   * `low` is not a guess about hardware: it is where the governor puts a device
   * that has twice failed to hold 45fps on its own frames.
   */
  lumenBlur: boolean;
  /**
   * A multiplier on the renderer's pixel ratio, BELOW the tier's own ceiling.
   *
   * The tier ladder bottoms out at `low`, and `low` still renders every
   * triangle at `dpr` 1. A device that cannot hold frame rate there had
   * nowhere left to go: the governor demoted it to the floor, saw it still
   * failing, and — by its own comment — reset the evidence rather than
   * accumulating a demotion it could not spend. The learner sat at 25 fps
   * forever while the system had concluded there was nothing to do.
   *
   * This is the lever underneath the floor, and it is the cheapest one there
   * is: halving the scale quarters the pixels shaded. The scene keeps every
   * character, every animation and every word — it is drawn softer, which is
   * a far better trade than a stutter.
   *
   * 1 at every tier by default; only the governor lowers it, and only for a
   * device already at `low` that is still missing its budget.
   */
  renderScale: number;
}

export const QUALITY_SETTINGS: Readonly<Record<QualityTier, QualitySettings>> = Object.freeze({
  low: { tier: 'low', reducedMotion: false, maxPixelRatio: 1, antialias: false, shadows: false, anisotropy: 1, ambientMotion: false, lumenBlur: false, renderScale: 1 },
  medium: { tier: 'medium', reducedMotion: false, maxPixelRatio: 1.5, antialias: true, shadows: false, anisotropy: 4, ambientMotion: true, lumenBlur: true, renderScale: 1 },
  high: { tier: 'high', reducedMotion: false, maxPixelRatio: 2, antialias: true, shadows: true, anisotropy: 8, ambientMotion: true, lumenBlur: true, renderScale: 1 },
});

/**
 * What the browser is willing to tell us. Every field is nullable ON PURPOSE:
 * `deviceMemory` is Chromium-only and `hardwareConcurrency` can be withheld by
 * privacy modes. Per /AGENTS.md §1.14, "the browser did not answer" must stay
 * distinguishable from "the answer was zero" — collapsing them would push
 * every Safari and Firefox user onto the low tier for no reason.
 */
export interface DeviceProbe {
  cores: number | null;
  memoryGb: number | null;
  /** Touch-primary input — a strong proxy for a thermally constrained device. */
  coarsePointer: boolean;
  devicePixelRatio: number;
  webgl: 'webgl2' | 'webgl1' | 'none';
  maxTextureSize: number | null;
  prefersReducedMotion: boolean;
}

/**
 * Picks the STARTING tier. Deliberately conservative and deliberately dumb —
 * it exists so the first frames are not catastrophic, and it is expected to be
 * overruled within a couple of seconds by real measurements.
 *
 * Starts at `medium` because that is the honest default under ignorance: a
 * browser that reports nothing is not evidence of a weak device, and shipping
 * everyone the low tier "to be safe" would degrade the product for the
 * majority to protect a minority the adaptive loop already protects.
 */
export function pickInitialTier(probe: DeviceProbe): QualityTier {
  if (probe.webgl === 'none') return 'low';

  // A GPU that cannot hold a 4096² texture is genuinely old hardware. This is
  // the one static signal strong enough to force the floor on its own.
  if (probe.maxTextureSize !== null && probe.maxTextureSize < 4096) return 'low';

  // WebGL1-only in 2026 means a device well outside the mainstream.
  if (probe.webgl === 'webgl1') return 'low';

  // Reported — not merely absent — evidence of a constrained device.
  if (probe.cores !== null && probe.cores <= 2) return 'low';
  if (probe.memoryGb !== null && probe.memoryGb <= 2) return 'low';

  const strongCpu = probe.cores !== null && probe.cores >= 8;
  const strongMemory = probe.memoryGb === null || probe.memoryGb >= 8;

  // Touch-primary devices are capped at medium regardless of reported specs:
  // phone SoCs sustain far less than their burst benchmarks once warm, and the
  // adaptive loop can still promote a genuinely capable tablet afterwards.
  if (probe.coarsePointer) return 'medium';

  return strongCpu && strongMemory ? 'high' : 'medium';
}

/** One step down the tier ladder; `low` is the floor. */
export function lowerTier(tier: QualityTier): QualityTier {
  const i = QUALITY_TIERS.indexOf(tier);
  return QUALITY_TIERS[Math.max(0, i - 1)] as QualityTier;
}

/** One step up the tier ladder; `high` is the ceiling. */
export function raiseTier(tier: QualityTier): QualityTier {
  const i = QUALITY_TIERS.indexOf(tier);
  return QUALITY_TIERS[Math.min(QUALITY_TIERS.length - 1, i + 1)] as QualityTier;
}

/**
 * Resolves the settings actually applied, folding in the accessibility
 * instruction. `prefers-reduced-motion` is honoured at every tier and is NOT a
 * performance signal — a user who asked for less motion on a fast machine
 * still gets less motion.
 */
export function resolveSettings(
  tier: QualityTier,
  prefersReducedMotion: boolean,
  renderScale = 1,
): QualitySettings {
  const base = QUALITY_SETTINGS[tier];
  const scaled = renderScale === 1 ? base : { ...base, renderScale };
  return prefersReducedMotion ? { ...scaled, ambientMotion: false, reducedMotion: true } : scaled;
}

/** The steps below `low`, in order. The floor is deliberately not zero. */
export const RENDER_SCALES = [1, 0.8, 0.65, 0.5] as const;

/** One step softer. Returns the same value at the floor. */
export function lowerRenderScale(scale: number): number {
  const floor: number = RENDER_SCALES[RENDER_SCALES.length - 1] ?? 0.5;
  const i = RENDER_SCALES.indexOf(scale as (typeof RENDER_SCALES)[number]);
  // An unrecognised scale goes straight to the floor rather than to step one:
  // the only way to hold a value that is not on the ladder is to already be
  // in trouble.
  if (i === -1) return floor;
  return RENDER_SCALES[Math.min(RENDER_SCALES.length - 1, i + 1)] ?? floor;
}

let cachedProbe: DeviceProbe | null = null;

/**
 * The probe every caller should use. Memoized for the page's lifetime because
 * probing creates a real WebGL context: browsers cap how many can exist at
 * once, so a component tree that probed per mount could starve the very canvas
 * it is about to render. Hardware does not change mid-session, so caching
 * costs nothing.
 */
export function getDeviceProbe(): DeviceProbe {
  if (!cachedProbe) cachedProbe = probeDevice();
  return cachedProbe;
}

/**
 * Reads the browser's self-reported capabilities. Creates a throwaway WebGL
 * context, reads what it needs, and explicitly releases it via
 * `WEBGL_lose_context` — browsers cap simultaneous live contexts (~8-16), and
 * a probe that leaked one would eventually starve the real canvas.
 *
 * Prefer `getDeviceProbe()` outside of tests.
 */
export function probeDevice(): DeviceProbe {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      cores: null,
      memoryGb: null,
      coarsePointer: false,
      devicePixelRatio: 1,
      webgl: 'none',
      maxTextureSize: null,
      prefersReducedMotion: false,
    };
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null;
  const memoryGb = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  let webgl: DeviceProbe['webgl'] = 'none';
  let maxTextureSize: number | null = null;

  const canvas = document.createElement('canvas');
  const gl = (canvas.getContext('webgl2') ??
    canvas.getContext('webgl')) as WebGL2RenderingContext | WebGLRenderingContext | null;

  if (gl) {
    webgl = 'WebGL2RenderingContext' in window && gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl1';
    const size = gl.getParameter(gl.MAX_TEXTURE_SIZE) as unknown;
    maxTextureSize = typeof size === 'number' ? size : null;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  return {
    cores,
    memoryGb,
    coarsePointer,
    devicePixelRatio: window.devicePixelRatio || 1,
    webgl,
    maxTextureSize,
    prefersReducedMotion,
  };
}
