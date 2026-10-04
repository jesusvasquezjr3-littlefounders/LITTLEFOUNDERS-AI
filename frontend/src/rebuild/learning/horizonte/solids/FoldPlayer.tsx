import { useId, useMemo } from 'react';
import { Button, Slider } from '../../../design/controls';
import { useFoldTween } from './foldTween';
import { FOLD_STEPS, foldRig, foldWindow, poseOf, projectPose, type FoldPanel } from './polyFold';
import { fill, type SolidsText } from './solidsText';

const rounded = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * The net folding up into its solid. A button runs the fold (a 250 ms tween only when the person has not asked for less motion,
 * otherwise it jumps to the end) and a slider scrubs it step by step, which is the keyboard path and the unhurried one. Each panel
 * keeps the number it has in the net, so the learner can follow where a panel ends up. Nothing here is graded.
 */
export function FoldPlayer({ t, panels }: { t: SolidsText; panels: readonly FoldPanel[] | null }) {
  const caption = useId();
  const heading = useId();
  const rig = useMemo(() => (panels ? foldRig(panels) : null), [panels]);
  const box = useMemo(() => (rig ? foldWindow(rig) : null), [rig]);
  const fold = useFoldTween();
  if (!rig || !box) return null;
  const step = Math.round(fold.t * FOLD_STEPS);
  const state = step === 0 ? t.foldFlat : step >= FOLD_STEPS ? t.foldClosed : fill(t.foldPart, { n: step, total: FOLD_STEPS });
  const pad = Math.max(box.maxX - box.minX, box.maxY - box.minY) * 0.06;
  const [width, height] = [box.maxX - box.minX + 2 * pad, box.maxY - box.minY + 2 * pad];
  const tag = Math.max(0.4, Math.max(width, height) * 0.035);
  const drawn = projectPose(poseOf(rig, fold.t), fold.t);
  return <div className="lf-net-previews lf-fold">
    <h3 id={heading} data-copy-role="heading">{t.foldHeading}</h3>
    <svg className="lf-fold-svg" viewBox={`${rounded(box.minX - pad)} ${rounded(box.minY - pad)} ${rounded(width)} ${rounded(height)}`} role="img" aria-labelledby={`${heading} ${caption}`}
      focusable="false" data-copy-role="data" style={{ aspectRatio: `${rounded(width)} / ${rounded(height)}` }}>
      {drawn.map((panel) => <g key={panel.index} data-outside={panel.outside ? 'true' : 'false'}>
        <polygon className="lf-fold-panel" data-shade={panel.shade} data-outside={panel.outside ? 'true' : 'false'} points={panel.points.map((point) => `${rounded(point[0])},${rounded(point[1])}`).join(' ')} />
        <text className="lf-fold-tag" x={rounded(panel.centre[0])} y={rounded(panel.centre[1] + tag * 0.35)} fontSize={rounded(tag)} textAnchor="middle">{panel.index + 1}</text>
      </g>)}
    </svg>
    <p id={caption} className="lf-solid-status" data-copy-role="data">{state}</p>
    <div className="lf-fold-controls">
      <Button size="sm" onClick={() => fold.go(step >= FOLD_STEPS ? 0 : 1)}>{step >= FOLD_STEPS ? t.unfold : t.fold}</Button>
      <Slider className="lf-fold-scrub" label={t.foldSlider} valueText={state} min={0} max={FOLD_STEPS} value={step} onValueChange={(value) => fold.set(value / FOLD_STEPS)} />
    </div>
  </div>;
}
