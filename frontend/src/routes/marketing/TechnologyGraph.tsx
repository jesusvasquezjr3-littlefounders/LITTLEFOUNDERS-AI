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
const STAGE_X = [0.12, 0.31, 0.5, 0.69, 0.88];
const ROW_Y = [0.18, 0.34, 0.5, 0.66, 0.82];
const NODE_COUNT = CONCEPTS.length;
const PATH_COUNT = 40;
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

function createAtlasNodes(): AtlasNode[] {
  return CONCEPTS.map((concept, index) => ({
    id: index,
    x: STAGE_X[concept.stage]! + (rand(index + 1) - 0.5) * 0.018,
    y: ROW_Y[concept.row]! + (rand(index + 41) - 0.5) * 0.035,
    z: Math.cos((concept.row / 4) * Math.PI) * 0.26 + (rand(index + 81) - 0.5) * 0.18,
    radius: concept.row === 2 ? 7.2 : 5 + rand(index + 121) * 2.5,
    tone: concept.tone,
    conceptKey: concept.conceptKey,
    stage: concept.stage,
    row: concept.row,
  }));
}

function createAtlasLinks(): AtlasLink[] {
  const links: AtlasLink[] = [];
  for (let stage = 0; stage < 5; stage += 1) {
    for (let row = 0; row < 4; row += 1) {
      links.push({ from: stage * 5 + row, to: stage * 5 + row + 1, kind: 'local' });
    }
    if (stage < 4) {
      for (let row = 0; row < 5; row += 1) {
        links.push({ from: stage * 5 + row, to: (stage + 1) * 5 + row, kind: 'bridge' });
      }
    }
  }
  return links;
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
  const [selected, setSelected] = useState<number | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const selectedRef = useRef(selected);
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
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
    if (!parent || parent.getBoundingClientRect().width === 0 || parent.getBoundingClientRect().height === 0) return;
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
    let lastPointerDrawAt = -Infinity;
    let projected: Array<{ node: AtlasNode; x: number; y: number; zDepth: number; scale: number }> = [];
    // Keep the cinematic glow crisp without letting Retina devices allocate
    // four times the pixels for an interaction redraw.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const colors = new Map(Object.values(toneVar).map((variable) => [variable, `rgb(${getComputedStyle(document.documentElement).getPropertyValue(variable)})`]));
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const film = parent.querySelector<HTMLVideoElement>('.lf-atlas__film');
    const syncPlayback = () => {
      const shouldPlay = isVisible && document.visibilityState === 'visible';
      if (shouldPlay) void film?.play().catch(() => undefined);
      else film?.pause();
    };
    const draw = (time: number) => {
      if (!isVisible || document.visibilityState !== 'visible') return;
      const rect = parent.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (!dragging && !reducedMotion) {
        rotation = Math.sin(time / 12000) * 0.14;
        tilt = Math.sin(time / 15000) * 0.06;
      }
      context!.clearRect(0, 0, width, height);
      projected = nodes.map((node) => {
        const x = (node.x - 0.5) * zoom;
        const y = (node.y - 0.5) * zoom;
        const cameraX = x * Math.cos(rotation) - node.z * Math.sin(rotation);
        const depth = node.z * Math.cos(rotation) + x * Math.sin(rotation);
        const cameraY = y * Math.cos(tilt) - depth * Math.sin(tilt);
        const zDepth = depth * Math.cos(tilt) + y * Math.sin(tilt);
        const scale = 0.62 + ((zDepth + 1) / 2) * 0.82;
        return { node, zDepth, scale, x: width / 2 + panX + cameraX * width * scale, y: height / 2 + panY + cameraY * height * scale };
      });
      const sorted = [...projected].sort((a, b) => a.zDepth - b.zDepth);
      context!.save();
      context!.globalAlpha = 0.22;
      context!.strokeStyle = colors.get('--lf-primary') ?? '#818cf8';
      context!.setLineDash([2, 10]);
      for (let stage = 0; stage < STAGE_X.length; stage += 1) {
        const x = width / 2 + panX + (STAGE_X[stage]! - 0.5) * width * zoom;
        context!.beginPath(); context!.moveTo(x, height * 0.1 + panY); context!.lineTo(x, height * 0.9 + panY); context!.stroke();
      }
      context!.setLineDash([]); context!.restore();
      links.forEach((link, linkIndex) => {
        const a = projected[link.from]; const b = projected[link.to];
        if (!a || !b) return;
        const isActive = a.node.id === selectedRef.current || b.node.id === selectedRef.current;
        const edgeColor = isActive ? (colors.get('--lf-delight') ?? '#f472b6') : (colors.get('--lf-primary') ?? '#818cf8');
        context!.save();
        context!.globalAlpha = isActive ? 0.82 : link.kind === 'bridge' ? 0.3 : 0.16;
        context!.strokeStyle = edgeColor;
        context!.lineWidth = isActive ? 2.2 : link.kind === 'bridge' ? 1.1 : 0.75;
        context!.shadowBlur = isActive ? 18 : link.kind === 'bridge' ? 8 : 0;
        context!.shadowColor = edgeColor;
        context!.globalCompositeOperation = 'lighter';
        context!.beginPath(); context!.moveTo(a.x, a.y); context!.lineTo(b.x, b.y); context!.stroke();
        const pulse = (time / 2200 + linkIndex * 0.14) % 1;
        context!.fillStyle = link.kind === 'bridge' ? (colors.get('--lf-success') ?? '#34d399') : edgeColor;
        for (let trail = 2; trail >= 0; trail -= 1) {
          const trailPulse = (pulse - trail * 0.035 + 1) % 1;
          const px = a.x + (b.x - a.x) * trailPulse;
          const py = a.y + (b.y - a.y) * trailPulse;
          context!.globalAlpha = (isActive ? 0.9 : 0.34) / (trail + 1);
          context!.beginPath(); context!.arc(px, py, (isActive ? 3.2 : 1.8) - trail * 0.35, 0, Math.PI * 2); context!.fill();
        }
        if (link.kind === 'bridge' && !reducedMotion) {
          const px = a.x + (b.x - a.x) * pulse;
          const py = a.y + (b.y - a.y) * pulse;
          context!.globalAlpha = 0.26;
          context!.strokeStyle = colors.get('--lf-success') ?? '#34d399';
          context!.lineWidth = 1;
          context!.beginPath(); context!.arc(px, py, 6 + Math.sin(time / 240) * 2, 0, Math.PI * 2); context!.stroke();
        }
        context!.restore();
      });
      sorted.forEach(({ node, x, y, scale, zDepth }) => {
        const active = node.id === selectedRef.current;
        const pulse = active && !reducedMotion ? 1 + Math.sin(time / 300) * 0.12 : 1;
        const nodeColor = colors.get(toneVar[node.tone]) ?? colors.get('--lf-primary') ?? '#818cf8';
        context!.save();
        context!.globalAlpha = active ? 1 : 0.48 + ((zDepth + 1) / 2) * 0.5;
        context!.fillStyle = nodeColor;
        context!.shadowBlur = active ? 28 : node.row === 2 ? 14 : 5;
        context!.shadowColor = nodeColor;
        context!.beginPath(); context!.arc(x, y, node.radius * scale * pulse, 0, Math.PI * 2); context!.fill();
        if (active) {
          context!.globalAlpha = 0.55;
          context!.strokeStyle = colors.get('--lf-on-inverse') ?? '#fff';
          context!.lineWidth = 1.2;
          context!.beginPath(); context!.arc(x, y, node.radius * scale * 3.3, 0, Math.PI * 2); context!.stroke();
        }
        context!.restore();
      });
    };
    const onPointerDown = (event: PointerEvent) => { dragging = true; dragStartX = event.clientX; dragStartY = event.clientY; startPanX = panX; startPanY = panY; startRotation = rotation; startTilt = tilt; canvas.setPointerCapture(event.pointerId); };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - dragStartX; const dy = event.clientY - dragStartY;
      panX = Math.max(-widthLimit(parent, 0.45), Math.min(widthLimit(parent, 0.45), startPanX + dx));
      panY = Math.max(-heightLimit(parent, 0.35), Math.min(heightLimit(parent, 0.35), startPanY + dy));
      rotation = startRotation + dx / 1400; tilt = Math.max(-0.38, Math.min(0.38, startTilt + dy / 1400));
      if (event.timeStamp - lastPointerDrawAt >= 1000 / 30) {
        lastPointerDrawAt = event.timeStamp;
        draw(performance.now());
      }
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
    const onVisibilityChange = () => { syncPlayback(); };
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? true;
      syncPlayback();
    }, { threshold: 0.01 }) : null;
    redrawRef.current = () => draw(performance.now());
    resize(); draw(0); syncPlayback(); observer?.observe(parent); document.addEventListener('visibilitychange', onVisibilityChange); window.addEventListener('resize', resize); canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', onPointerCancel);
    return () => { redrawRef.current = null; observer?.disconnect(); film?.pause(); document.removeEventListener('visibilitychange', onVisibilityChange); window.removeEventListener('resize', resize); canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerCancel); };
  }, [links, nodes, reducedMotion]);

  const active = nodes.find((node) => node.id === selected) ?? nodes[0]!;
  const related = selected === null ? [] : links.filter((link) => link.from === selected || link.to === selected).slice(0, 3).map((link) => link.from === selected ? link.to : link.from);
  return (
    <div className={`lf-atlas ${compact ? 'lf-atlas-compact' : ''} ${showTitle ? '' : 'lf-atlas-no-title'}`}>
      <video className="lf-atlas__film" autoPlay loop muted playsInline preload="metadata" aria-hidden="true"><source src="/marketing/knowledge-graph.mp4" type="video/mp4" /></video>
      <canvas ref={canvasRef} className="lf-atlas__canvas" aria-label={t('marketing.technology.atlas.ariaLabel')} role="img" />
      <div className="lf-atlas__backdrop" aria-hidden="true" />
      <div className="lf-atlas__title"><span>{t('marketing.technology.atlas.eyebrow')}</span><h2>{t('marketing.technology.atlas.titleLead')}<br /><em>{t('marketing.technology.atlas.titleAccent')}</em></h2><p>{t('marketing.technology.atlas.body')}</p><div className="lf-atlas__stats"><b>{NODE_COUNT}</b><span>{t('marketing.technology.atlas.nodes')}</span><b>{PATH_COUNT}</b><span>{t('marketing.technology.atlas.paths')}</span></div></div>
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
