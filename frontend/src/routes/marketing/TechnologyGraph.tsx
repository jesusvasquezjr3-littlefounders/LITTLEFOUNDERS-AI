import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './TechnologyGraph.css';

type ConceptKey =
  | 'curiosity' | 'needs' | 'goal' | 'value' | 'question'
  | 'choice' | 'needsVsWants' | 'price' | 'compare' | 'budget'
  | 'saving' | 'plan' | 'prioritize' | 'tradeoff' | 'time'
  | 'create' | 'resource' | 'offer' | 'cost' | 'revenue'
  | 'share' | 'iterate' | 'reflect' | 'confidence' | 'nextStep';
type Tone = 'primary' | 'delight' | 'success' | 'on';

interface AtlasNode {
  id: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  tone: Tone;
  conceptKey: ConceptKey;
  stage: number;
  row: number;
}

interface AtlasLink { from: number; to: number; kind: 'local' | 'bridge'; }

/** A dim, unconnected twinkle — pure atmosphere, no graph meaning, no links. */
interface AmbientBubble { x: number; y: number; z: number; radius: number; tone: Tone; phase: number; speed: number; }

const CONCEPTS: Array<{ conceptKey: ConceptKey; stage: number; row: number; tone: Tone }> = [
  { conceptKey: 'curiosity', stage: 0, row: 0, tone: 'delight' },
  { conceptKey: 'needs', stage: 0, row: 1, tone: 'delight' },
  { conceptKey: 'goal', stage: 0, row: 2, tone: 'delight' },
  { conceptKey: 'value', stage: 0, row: 3, tone: 'delight' },
  { conceptKey: 'question', stage: 0, row: 4, tone: 'delight' },
  { conceptKey: 'choice', stage: 1, row: 0, tone: 'primary' },
  { conceptKey: 'needsVsWants', stage: 1, row: 1, tone: 'primary' },
  { conceptKey: 'price', stage: 1, row: 2, tone: 'primary' },
  { conceptKey: 'compare', stage: 1, row: 3, tone: 'primary' },
  { conceptKey: 'budget', stage: 1, row: 4, tone: 'primary' },
  { conceptKey: 'saving', stage: 2, row: 0, tone: 'success' },
  { conceptKey: 'plan', stage: 2, row: 1, tone: 'success' },
  { conceptKey: 'prioritize', stage: 2, row: 2, tone: 'success' },
  { conceptKey: 'tradeoff', stage: 2, row: 3, tone: 'success' },
  { conceptKey: 'time', stage: 2, row: 4, tone: 'success' },
  { conceptKey: 'create', stage: 3, row: 0, tone: 'delight' },
  { conceptKey: 'resource', stage: 3, row: 1, tone: 'delight' },
  { conceptKey: 'offer', stage: 3, row: 2, tone: 'delight' },
  { conceptKey: 'cost', stage: 3, row: 3, tone: 'delight' },
  { conceptKey: 'revenue', stage: 3, row: 4, tone: 'delight' },
  { conceptKey: 'share', stage: 4, row: 0, tone: 'on' },
  { conceptKey: 'iterate', stage: 4, row: 1, tone: 'on' },
  { conceptKey: 'reflect', stage: 4, row: 2, tone: 'on' },
  { conceptKey: 'confidence', stage: 4, row: 3, tone: 'on' },
  { conceptKey: 'nextStep', stage: 4, row: 4, tone: 'on' },
];
// A literal tree, root to canopy: stage 0 is the root system at the BOTTOM
// (large y = low on screen, since y=0 is the top of the normalized 0..1
// space the projection below maps to screen coordinates), stage 4 is the
// canopy at the TOP. TREE_SPREAD widens with stage — tight near the trunk,
// fanning out into branches — instead of the old fixed-column grid.
const TREE_Y = [0.92, 0.73, 0.54, 0.35, 0.16];
// Deliberately steep progression (trunk-tight to canopy-wide) so the
// silhouette reads as an unmistakable cone/tree shape even before any
// rotation — a gentle progression looked like a loose cluster, not a tree.
// Screen split into quarters, tree centered between the 3rd and 4th (the
// hero copy occupies roughly the left half, so this sits in the open
// right side instead of overlapping it or sitting dead-center). Spread is
// scaled down from the centered version so the canopy's widest point
// still lands inside that same right-hand region instead of running off
// the edge of the section.
const TREE_CENTER_X = 0.74;
const TREE_SPREAD = [0.008, 0.025, 0.08, 0.15, 0.24];
const NODE_COUNT = CONCEPTS.length;
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const clampRow = (row: number) => Math.max(0, Math.min(4, row));

function createAtlasNodes(): AtlasNode[] {
  return CONCEPTS.map((concept, index) => {
    const spread = TREE_SPREAD[concept.stage]!;
    const lateral = (concept.row - 2) / 2; // -1 (leftmost) .. 0 (trunk) .. 1 (rightmost)
    // Jitter scales down near the trunk and up in the canopy — the roots
    // and lower trunk stay a crisp, unmistakable vertical line; only the
    // upper branches get the organic scatter.
    const jitter = 0.4 + concept.stage * 0.6;
    return {
      id: index,
      x: TREE_CENTER_X + lateral * spread + (rand(index + 1) - 0.5) * 0.01 * jitter,
      // Outer branches sit a little higher than the trunk row at the same
      // stage, like real limbs angling upward off the trunk.
      y: TREE_Y[concept.stage]! - Math.abs(lateral) * 0.045 + (rand(index + 41) - 0.5) * 0.015 * jitter,
      z: Math.sin(lateral * Math.PI) * 0.3 + (rand(index + 81) - 0.5) * 0.12 * jitter,
      radius: concept.row === 2 ? 7.2 : 5 + rand(index + 121) * 2.5,
      tone: concept.tone,
      conceptKey: concept.conceptKey,
      stage: concept.stage,
      row: concept.row,
    };
  });
}

/**
 * A real tree only ever SPLITS going up — branches don't merge back
 * together — so every non-root node gets exactly one parent one stage
 * down, picked at a nearby (not necessarily same) row for natural-looking
 * limbs rather than dead-straight verticals. That alone guarantees an
 * actual tree shape (connected, acyclic) instead of the old full-grid mesh
 * OR the prior "sparse random mesh" pass — a tree, not just a less-dense
 * mesh. Deterministic (same seeded `rand` pattern as node jitter), so the
 * shape is stable across renders. Stage 0 (the roots) additionally links
 * to its immediate neighbors, reading as a spreading root system at the
 * base rather than five disconnected points.
 */
function createAtlasLinks(): AtlasLink[] {
  const links: AtlasLink[] = [];
  for (let row = 0; row < 4; row += 1) {
    links.push({ from: row, to: row + 1, kind: 'local' });
  }
  for (let stage = 1; stage < 5; stage += 1) {
    for (let row = 0; row < 5; row += 1) {
      const child = stage * 5 + row;
      const drift = Math.round((rand(child + 500) - 0.5) * 3); // -1, 0, or 1 row
      const parentRow = clampRow(row + drift);
      links.push({ from: (stage - 1) * 5 + parentRow, to: child, kind: 'bridge' });
    }
  }
  return links;
}

const AMBIENT_BUBBLE_COUNT = 46;
const AMBIENT_TONES: Tone[] = ['primary', 'delight', 'success', 'on'];
/**
 * Scattered through the same tree volume as the real nodes, but entirely
 * decorative: no links, no concept, no click target. Just fills the space
 * around the branches with a soft, twinkling density. Deterministic (same
 * seeded `rand` pattern as everything else here), and cheap by
 * construction — reuses the exact same cached glow sprites the real nodes
 * already draw with, just at a lower, independently-oscillating alpha.
 */
function createAmbientBubbles(): AmbientBubble[] {
  return Array.from({ length: AMBIENT_BUBBLE_COUNT }, (_, i) => {
    const stage = rand(i + 3000) * 4;
    const spread = TREE_SPREAD[Math.min(4, Math.round(stage))]! * 1.6;
    return {
      x: TREE_CENTER_X + (rand(i + 3100) - 0.5) * spread * 2,
      y: TREE_Y[0]! - stage / 4 * (TREE_Y[0]! - TREE_Y[4]!) + (rand(i + 3200) - 0.5) * 0.05,
      z: (rand(i + 3300) - 0.5) * 0.5,
      radius: 1.3 + rand(i + 3400) * 2.2,
      tone: AMBIENT_TONES[Math.floor(rand(i + 3500) * AMBIENT_TONES.length)]!,
      phase: rand(i + 3600) * Math.PI * 2,
      speed: 1800 + rand(i + 3700) * 2400,
    };
  });
}

const GLOW_SPRITE_SIZE = 128;
function withAlpha(rgbColor: string, alpha: number): string {
  // This codebase's CSS custom properties are space-separated triplets
  // ("79 70 229", wrapped into "rgb(79 70 229)" by the caller) — the modern
  // CSS Color 4 slash syntax is the correct way to add alpha to that, not
  // legacy comma syntax (rgb(79 70 229, 0.5) is invalid CSS and throws).
  return rgbColor.replace(')', ` / ${alpha})`);
}
/**
 * A soft round glow, pre-rendered ONCE per color into an offscreen canvas.
 * Every frame then just drawImage()s this instead of asking Canvas2D to
 * recompute a shadowBlur convolution per shape — shadowBlur is a genuine
 * per-pixel blur, re-run on every draw call, and doing it for ~25 nodes plus
 * dozens of links at 60fps is exactly the kind of sustained CPU load that
 * spins laptop fans. drawImage() of a cached bitmap is a cheap, normally
 * GPU-composited blit regardless of how many times it's stamped down.
 */
function makeGlowSprite(rgbColor: string): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = GLOW_SPRITE_SIZE;
  sprite.height = GLOW_SPRITE_SIZE;
  const sctx = sprite.getContext('2d')!;
  const r = GLOW_SPRITE_SIZE / 2;
  const gradient = sctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, withAlpha(rgbColor, 0.95));
  gradient.addColorStop(0.35, withAlpha(rgbColor, 0.45));
  gradient.addColorStop(1, withAlpha(rgbColor, 0));
  sctx.fillStyle = gradient;
  sctx.fillRect(0, 0, GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE);
  return sprite;
}

const toneVar: Record<Tone, string> = {
  primary: '--lf-primary',
  delight: '--lf-delight',
  success: '--lf-success',
  on: '--lf-on-inverse-muted',
};

const conceptImages: Record<ConceptKey, string> = {
  curiosity: '/marketing/atlas/7938020.jpg', needs: '/marketing/atlas/3985092.jpg', goal: '/marketing/atlas/12357524.jpg', value: '/marketing/atlas/12357525.jpg', question: '/marketing/atlas/8213262.jpg',
  choice: '/marketing/atlas/3985077.jpg', needsVsWants: '/marketing/atlas/12357425.jpg', price: '/marketing/atlas/3985081.jpg', compare: '/marketing/atlas/3985056.jpg', budget: '/marketing/atlas/34383963.jpg',
  saving: '/marketing/atlas/7646224.jpg', plan: '/marketing/atlas/34471650.jpg', prioritize: '/marketing/atlas/9207491.jpg', tradeoff: '/marketing/atlas/8208755.jpg', time: '/marketing/atlas/7669175.jpg',
  create: '/marketing/atlas/32760477.jpg', resource: '/marketing/atlas/8798702.jpg', offer: '/marketing/atlas/15955290.jpg', cost: '/marketing/atlas/4894603.jpg', revenue: '/marketing/atlas/5082866.jpg',
  share: '/marketing/atlas/7489083.jpg', iterate: '/marketing/atlas/7671313.jpg', reflect: '/marketing/atlas/6274956.jpg', confidence: '/marketing/atlas/4609073.jpg', nextStep: '/marketing/atlas/7118210.jpg',
};

export function TechnologyGraph({ compact = false, showTitle = !compact }: { compact?: boolean; showTitle?: boolean }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodes = useMemo(createAtlasNodes, []);
  const links = useMemo(createAtlasLinks, []);
  const bubbles = useMemo(createAmbientBubbles, []);
  const [selected, setSelected] = useState<number | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const selectedRef = useRef(selected);
  const redrawRef = useRef<(() => void) | null>(null);
  const ensureLoopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
    // Re-enabling motion (reducedMotion -> false) must resume the idle sway
    // loop, not just repaint once — a single redraw() alone would leave the
    // canvas frozen at whatever rotation it last had.
    ensureLoopRef.current?.();
    redrawRef.current?.();
  }, [reducedMotion, selected]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const sync = () => setReducedMotion(query.matches);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    let context: CanvasRenderingContext2D | null = null;
    try { context = canvas.getContext('2d'); } catch { return; }
    if (!context) return;
    let isVisible = true;
    let rotation = 0;
    let tilt = 0;
    let panX = 0;
    let panY = 0;
    const zoom = 1;
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startPanX = 0;
    let startPanY = 0;
    let startRotation = 0;
    let startTilt = 0;
    let rafId: number | null = null;
    let projected: Array<{ node: AtlasNode; x: number; y: number; zDepth: number; scale: number }> = [];
    // Keep the cinematic glow crisp without letting Retina devices allocate
    // four times the pixels for an interaction redraw.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const colors = new Map(Object.values(toneVar).map((variable) => [variable, `rgb(${getComputedStyle(document.documentElement).getPropertyValue(variable)})`]));
    // Built once per effect run (colors are static for the session), not
    // per frame — see makeGlowSprite's doc comment.
    const glowSprites = new Map([...colors.values()].map((rgb) => [rgb, makeGlowSprite(rgb)]));
    const glowFor = (rgb: string) => glowSprites.get(rgb) ?? (glowSprites.set(rgb, makeGlowSprite(rgb)), glowSprites.get(rgb)!);
    const drawGlow = (rgb: string, x: number, y: number, radius: number) => {
      const sprite = glowFor(rgb);
      context!.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    };
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (time: number) => {
      if (!isVisible || document.visibilityState !== 'visible') return;
      const rect = parent.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (!dragging && !reducedMotion) {
        // A slow, continuous one-directional spin around the tree's own
        // vertical axis (like a turntable) reads unambiguously as "this is
        // a 3D object rotating" — a back-and-forth few-degree sway (the
        // previous approach) is too subtle to notice. One full turn every
        // ~26s; tilt keeps a gentle independent bob so it doesn't feel
        // robotic.
        rotation = (time / 26000) % (Math.PI * 2);
        tilt = Math.sin(time / 9000) * 0.08;
      }
      context!.clearRect(0, 0, width, height);
      const project = (nx: number, ny: number, nz: number) => {
        const x = (nx - 0.5) * zoom;
        const y = (ny - 0.5) * zoom;
        const cameraX = x * Math.cos(rotation) - nz * Math.sin(rotation);
        const depth = nz * Math.cos(rotation) + x * Math.sin(rotation);
        const cameraY = y * Math.cos(tilt) - depth * Math.sin(tilt);
        const zDepth = depth * Math.cos(tilt) + y * Math.sin(tilt);
        const scale = 0.62 + ((zDepth + 1) / 2) * 0.82;
        return { zDepth, scale, x: width / 2 + panX + cameraX * width * scale, y: height / 2 + panY + cameraY * height * scale };
      };
      projected = nodes.map((node) => ({ node, ...project(node.x, node.y, node.z) }));
      const sorted = [...projected].sort((a, b) => a.zDepth - b.zDepth);

      // Ambient bubbles: dim, independently-twinkling, unconnected to
      // anything — pure atmosphere to fill the space between real branches.
      // Same cached-sprite glow as the real nodes (no shadowBlur), just at
      // low alpha, so this doesn't add meaningfully to the per-frame cost.
      context!.save();
      context!.globalCompositeOperation = 'lighter';
      for (const bubble of bubbles) {
        const p = project(bubble.x, bubble.y, bubble.z);
        const twinkle = 0.5 + Math.sin(time / bubble.speed + bubble.phase) * 0.5;
        const bubbleColor = colors.get(toneVar[bubble.tone]) ?? colors.get('--lf-primary') ?? '#818cf8';
        context!.globalAlpha = (0.08 + twinkle * 0.18) * p.scale;
        drawGlow(bubbleColor, p.x, p.y, bubble.radius * p.scale * 3);
      }
      context!.restore();

      // Plain strokes for every link (cheap: no shadowBlur, `lighter` additive
      // blending alone already reads as "glowing" where lines overlap) — the
      // expensive cached-sprite glow is spent ONLY on the handful of links
      // touching the selected node, never on all ~50 of them every frame.
      links.forEach((link, linkIndex) => {
        const a = projected[link.from]; const b = projected[link.to];
        if (!a || !b) return;
        const isActive = a.node.id === selectedRef.current || b.node.id === selectedRef.current;
        const edgeColor = isActive ? (colors.get('--lf-delight') ?? '#f472b6') : (colors.get('--lf-primary') ?? '#818cf8');
        context!.save();
        context!.globalAlpha = isActive ? 0.82 : link.kind === 'bridge' ? 0.3 : 0.16;
        context!.strokeStyle = edgeColor;
        context!.lineWidth = isActive ? 2.2 : link.kind === 'bridge' ? 1.1 : 0.75;
        context!.globalCompositeOperation = 'lighter';
        context!.beginPath(); context!.moveTo(a.x, a.y); context!.lineTo(b.x, b.y); context!.stroke();
        context!.restore();
        if (isActive) {
          context!.save();
          context!.globalCompositeOperation = 'lighter';
          drawGlow(edgeColor, (a.x + b.x) / 2, (a.y + b.y) / 2, 22);
          context!.restore();
        }
        const pulse = (time / 2200 + linkIndex * 0.14) % 1;
        const trailColor = link.kind === 'bridge' ? (colors.get('--lf-success') ?? '#34d399') : edgeColor;
        context!.save();
        context!.globalCompositeOperation = 'lighter';
        context!.fillStyle = trailColor;
        for (let trail = 2; trail >= 0; trail -= 1) {
          const trailPulse = (pulse - trail * 0.035 + 1) % 1;
          const px = a.x + (b.x - a.x) * trailPulse;
          const py = a.y + (b.y - a.y) * trailPulse;
          context!.globalAlpha = (isActive ? 0.9 : 0.34) / (trail + 1);
          context!.beginPath(); context!.arc(px, py, (isActive ? 3.2 : 1.8) - trail * 0.35, 0, Math.PI * 2); context!.fill();
        }
        context!.restore();
        if (link.kind === 'bridge' && !reducedMotion) {
          const px = a.x + (b.x - a.x) * pulse;
          const py = a.y + (b.y - a.y) * pulse;
          context!.save();
          context!.globalAlpha = 0.26;
          context!.strokeStyle = colors.get('--lf-success') ?? '#34d399';
          context!.lineWidth = 1;
          context!.beginPath(); context!.arc(px, py, 6 + Math.sin(time / 240) * 2, 0, Math.PI * 2); context!.stroke();
          context!.restore();
        }
      });
      sorted.forEach(({ node, x, y, scale, zDepth }) => {
        const active = node.id === selectedRef.current;
        const pulse = active && !reducedMotion ? 1 + Math.sin(time / 300) * 0.12 : 1;
        const nodeColor = colors.get(toneVar[node.tone]) ?? colors.get('--lf-primary') ?? '#818cf8';
        const coreRadius = node.radius * scale * pulse;
        context!.save();
        context!.globalAlpha = active ? 1 : 0.48 + ((zDepth + 1) / 2) * 0.5;
        context!.globalCompositeOperation = 'lighter';
        // Cached-sprite glow (cheap blit) replaces a per-node shadowBlur —
        // the glow radius still scales with the same "active/mid-row/rest"
        // tiers the old shadowBlur values encoded (28 / 14 / 5).
        drawGlow(nodeColor, x, y, coreRadius * (active ? 3.4 : node.row === 2 ? 2.6 : 1.9));
        context!.restore();
        context!.save();
        context!.globalAlpha = active ? 1 : 0.48 + ((zDepth + 1) / 2) * 0.5;
        context!.fillStyle = nodeColor;
        context!.beginPath(); context!.arc(x, y, coreRadius, 0, Math.PI * 2); context!.fill();
        if (active) {
          context!.globalAlpha = 0.55;
          context!.strokeStyle = colors.get('--lf-on-inverse') ?? '#fff';
          context!.lineWidth = 1.2;
          context!.beginPath(); context!.arc(x, y, coreRadius * 3.3, 0, Math.PI * 2); context!.stroke();
        }
        context!.restore();
      });
    };
    // Single render loop drives everything (idle sway, drag feedback, and
    // what a looping background video used to fake): a plain requestAnimationFrame
    // ticker, paused whenever nobody could be seeing it (scrolled off-screen
    // via IntersectionObserver, tab hidden) or when the user asked the OS for
    // reduced motion — direct drag input still runs it even then, since that's
    // response to input, not unprompted animation.
    // Ambient sway is a slow multi-second sine wave — nobody can see the
    // difference between 60fps and 30fps for that, so idle frames are
    // throttled to roughly halve sustained CPU cost. Dragging stays
    // uncapped: that's direct-manipulation feedback, worth the extra frames.
    let lastFrameTime = 0;
    const tick = (time: number) => {
      const minInterval = dragging ? 0 : 1000 / 30;
      if (time - lastFrameTime >= minInterval) {
        lastFrameTime = time;
        draw(time);
      }
      rafId = shouldAnimate() ? requestAnimationFrame(tick) : null;
    };
    const shouldAnimate = () => isVisible && document.visibilityState === 'visible' && (dragging || !reducedMotion);
    const ensureLoop = () => {
      if (rafId === null && shouldAnimate()) rafId = requestAnimationFrame(tick);
    };
    ensureLoopRef.current = ensureLoop;
    const onPointerDown = (event: PointerEvent) => { dragging = true; dragStartX = event.clientX; dragStartY = event.clientY; startPanX = panX; startPanY = panY; startRotation = rotation; startTilt = tilt; canvas.setPointerCapture(event.pointerId); ensureLoop(); };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - dragStartX; const dy = event.clientY - dragStartY;
      panX = Math.max(-widthLimit(parent, 0.45), Math.min(widthLimit(parent, 0.45), startPanX + dx));
      panY = Math.max(-heightLimit(parent, 0.35), Math.min(heightLimit(parent, 0.35), startPanY + dy));
      rotation = startRotation + dx / 1400; tilt = Math.max(-0.38, Math.min(0.38, startTilt + dy / 1400));
      // No manual draw() here: the rAF loop (already running, started by
      // onPointerDown) picks up these values on its next frame.
    };
    const onPointerUp = (event: PointerEvent) => {
      const moved = Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY);
      dragging = false;
      if (moved < 8) {
        const parentRect = parent.getBoundingClientRect();
        const pointerX = event.clientX - parentRect.left;
        const pointerY = event.clientY - parentRect.top;
        const closest = projected.reduce<{ node: AtlasNode; distance: number } | null>((found, item) => {
          const distance = Math.hypot(item.x - pointerX, item.y - pointerY);
          return !found || distance < found.distance ? { node: item.node, distance } : found;
        }, null);
        if (closest && closest.distance < 34) { setSelected(closest.node.id); setInspectorOpen(true); }
      }
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onPointerCancel = (event: PointerEvent) => { dragging = false; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
    const onVisibilityChange = () => { ensureLoop(); };
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? true;
      ensureLoop();
    }, { threshold: 0.01 }) : null;
    redrawRef.current = () => draw(performance.now());
    // A one-shot getBoundingClientRect() check at effect-setup time is not
    // reliable: if the parent still measures 0×0 at that exact instant (e.g.
    // a still-settling layout pass), nothing would ever retry, since this
    // effect's deps never change again after mount — permanently stranding
    // the canvas at its default 300×150 intrinsic size. ResizeObserver fires
    // with the real size as soon as one exists, and again on every future
    // change, so this self-heals instead of depending on getting lucky once.
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { resize(); draw(performance.now()); }) : null;
    resizeObserver?.observe(parent);
    resize(); draw(0); ensureLoop(); observer?.observe(parent); document.addEventListener('visibilitychange', onVisibilityChange); window.addEventListener('resize', resize); canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', onPointerCancel);
    return () => { redrawRef.current = null; ensureLoopRef.current = null; if (rafId !== null) cancelAnimationFrame(rafId); observer?.disconnect(); resizeObserver?.disconnect(); document.removeEventListener('visibilitychange', onVisibilityChange); window.removeEventListener('resize', resize); canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerCancel); };
  }, [links, nodes, bubbles, reducedMotion]);

  const active = nodes.find((node) => node.id === selected) ?? nodes[0]!;
  const related = selected === null ? [] : links.filter((link) => link.from === selected || link.to === selected).slice(0, 3).map((link) => link.from === selected ? link.to : link.from);
  return (
    <div className={`lf-atlas ${compact ? 'lf-atlas-compact' : ''} ${showTitle ? '' : 'lf-atlas-no-title'}`}>
      <canvas ref={canvasRef} className="lf-atlas__canvas" aria-label={t('marketing.technology.atlas.ariaLabel')} role="img" />
      <div className="lf-atlas__backdrop" aria-hidden="true" />
      <div className="lf-atlas__title"><span>{t('marketing.technology.atlas.eyebrow')}</span><h2>{t('marketing.technology.atlas.titleLead')}<br /><em>{t('marketing.technology.atlas.titleAccent')}</em></h2><p>{t('marketing.technology.atlas.body')}</p><div className="lf-atlas__stats"><b>{NODE_COUNT}</b><span>{t('marketing.technology.atlas.nodes')}</span><b>{links.length}</b><span>{t('marketing.technology.atlas.paths')}</span></div></div>
      {inspectorOpen && <aside className="lf-atlas__inspector">
        <button type="button" className="lf-atlas__close" onClick={() => setInspectorOpen(false)} aria-label={t('marketing.technology.atlas.close')}>×</button>
        <h3>{t(`marketing.technology.concepts.${active.conceptKey}.title`)}</h3>
        <img className="lf-atlas__concept-image" src={conceptImages[active.conceptKey]} alt={t(`marketing.technology.concepts.${active.conceptKey}.title`)} />
        <p>{t(`marketing.technology.concepts.${active.conceptKey}.body`)}</p>
        <div className="lf-atlas__pedagogy"><span>{t('marketing.technology.atlas.pedagogy')}</span><strong>{t('marketing.technology.atlas.connections')}</strong><div className="lf-atlas__items">{related.map((id) => <button key={id} type="button" onClick={() => setSelected(id)} className="lf-atlas__item"><i />{t(`marketing.technology.concepts.${nodes[id]!.conceptKey}.title`)}</button>)}</div></div>
      </aside>}
    </div>
  );
}

function widthLimit(element: HTMLElement, ratio: number) { return element.getBoundingClientRect().width * ratio; }
function heightLimit(element: HTMLElement, ratio: number) { return element.getBoundingClientRect().height * ratio; }
