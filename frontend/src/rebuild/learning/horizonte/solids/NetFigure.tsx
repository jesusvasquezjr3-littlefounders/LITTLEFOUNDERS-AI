import type { KeyboardEvent } from 'react';
import { centroidOf, measureMarks, pathOf, viewBoxOf, type Frame } from './netFrame';
import type { Measure, Pt } from './polynet.generated';

/** The pixels one unit of the net takes at its natural size; the figure shrinks to the width it is given and grows to a wider screen only so far. */
export const NET_SCALE = 26;
const NATURAL_WIDTH = { min: 220, max: 340 } as const;
const WIDEST = 460;
const TEXT_PX = 13;

const round = (value: number): number => Math.round(value * 1000) / 1000;

/** What the drag-place hook's target function hands back: the drop-target attributes and, while something is carried, the tap that places it. */
export interface DropProps { 'data-drop-target': string; 'data-drop-selected': string; 'data-drop-armed': string; onClick?: () => void }

export interface FigurePanel {
  id: string;
  /** Shown in the middle when the name does not fit, and the number the table and the Move to menu use. */
  number: number;
  points: readonly Pt[];
  measures: readonly Measure[];
  name: string | null;
  state: 'open' | 'named' | 'given' | 'added' | 'plain';
  /** Present when the panel is a control; absent for a plain drawing. */
  label?: string;
  enabled?: boolean;
  onPress?: () => void;
  /** The drop-target id of the panel (label mode drops a name here). */
  target?: string;
}

/** A hinge a carried face can hang from, drawn as a thick line on the edge of a face already in the net (screen units, y already flipped). */
export interface FigureHinge { id: string; from: Pt; to: Pt; label: string }

/** The sheet the net must fit, as a window in screen units. */
export interface FigureSheet { x: number; y: number; width: number; height: number }

const naturalWidth = (frame: Frame): number => Math.min(NATURAL_WIDTH.max, Math.max(NATURAL_WIDTH.min, frame.width * NET_SCALE));

/** The size of the text on a net, in net units: about 13 px when the picture has its natural width, so a wide net keeps legible text. */
export const figureFont = (frame: Frame): number => (TEXT_PX * frame.width) / naturalWidth(frame);

/** The size a name fits at inside its panel while keeping clear of the lengths along the sides, or null when it would be too small to read. */
function nameFont(points: readonly Pt[], text: string, font: number): number | null {
  const xs = points.map((point) => point[0]);
  const width = Math.max(...xs) - Math.min(...xs);
  const room = (points.length === 4 ? width : width * 0.55) - 2 * font;
  const need = [...text].length * 0.6 * font;
  if (need <= room) return font;
  const shrunk = (font * room) / need;
  return shrunk >= 0.7 * font ? shrunk : null;
}

/** Enter or Space on a drawn control is the tap on it: the click bubbles, so a carried chip is placed exactly as a pointer would place it. */
function press(event: KeyboardEvent<SVGGElement>) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function PanelDrawing({ panel, font }: { panel: FigurePanel; font: number }) {
  const centre = centroidOf(panel.points);
  const marks = measureMarks(panel.points, panel.measures, font * 0.7);
  const fitted = panel.name ? nameFont(panel.points, panel.name, font) : null;
  const size = fitted ?? font;
  return <>
    <polygon className="lf-poly-face" data-state={panel.state} points={pathOf(panel.points)} />
    {marks.guides.map((guide, at) => <line key={at} className="lf-poly-guide" x1={round(guide.from[0])} y1={round(-guide.from[1])} x2={round(guide.to[0])} y2={round(-guide.to[1])} />)}
    {marks.labels.map((mark, at) => <text key={at} className="lf-poly-len" x={round(mark.at[0])} y={round(-mark.at[1] + font * 0.35)} fontSize={round(font)} textAnchor="middle">{mark.text}</text>)}
    <text className="lf-poly-name" data-shows={fitted !== null ? 'name' : 'number'} x={round(centre[0])} y={round(-centre[1] + size * 0.35)} fontSize={round(size)} textAnchor="middle">
      {fitted !== null ? panel.name : panel.number}
    </text>
  </>;
}

/*
 * A flat net drawn from its panels: every panel is a polygon with the lengths written along its sides, a name or a number in the
 * middle and, when a hinge may be chosen, a thick line on the edge where a carried face can hang. A panel with a label is a control
 * (role button, focusable, Enter or Space is a tap); a panel with a drop target also takes a carried chip. The drawing is the
 * one picture of the net; the table beside it is its text equivalent.
 */
export function NetFigure({ frame, panels, hinges = [], sheet = null, label, role, drop }: {
  frame: Frame; panels: readonly FigurePanel[]; hinges?: readonly FigureHinge[]; sheet?: FigureSheet | null; label: string; role: 'img' | 'group';
  drop?: (id: string) => DropProps;
}) {
  const font = figureFont(frame);
  return <svg className="lf-poly-svg" viewBox={viewBoxOf(frame)} role={role} aria-label={label} focusable="false" data-copy-role="data"
    style={{ inlineSize: `min(100%, ${round(Math.min(WIDEST, Math.max(NATURAL_WIDTH.min, frame.width * NET_SCALE)))}px)`, aspectRatio: `${round(frame.width)} / ${round(frame.height)}` }}>
    {sheet ? <rect className="lf-poly-sheet" x={round(sheet.x)} y={round(sheet.y)} width={round(sheet.width)} height={round(sheet.height)} /> : null}
    {panels.map((panel) => {
      const drag = panel.target && drop ? drop(panel.target) : {};
      return <g key={panel.id} className="lf-poly" {...drag}>
        {panel.label === undefined ? <PanelDrawing panel={panel} font={font} />
          : <g className="lf-poly-button" role="button" tabIndex={0} aria-label={panel.label} aria-disabled={!panel.enabled} data-state={panel.state}
            onClick={panel.enabled ? panel.onPress : undefined} onKeyDown={press}>
            <PanelDrawing panel={panel} font={font} />
          </g>}
      </g>;
    })}
    {hinges.map((hinge) => <g key={hinge.id} className="lf-poly-hinge" role="button" tabIndex={0} aria-label={hinge.label} onKeyDown={press} {...(drop ? drop(hinge.id) : {})}>
      <line className="lf-poly-hinge-hit" x1={round(hinge.from[0])} y1={round(hinge.from[1])} x2={round(hinge.to[0])} y2={round(hinge.to[1])} strokeWidth={round(font * 2)} />
      <line className="lf-poly-hinge-line" x1={round(hinge.from[0])} y1={round(hinge.from[1])} x2={round(hinge.to[0])} y2={round(hinge.to[1])} strokeWidth={round(font * 0.5)} />
    </g>)}
  </svg>;
}
