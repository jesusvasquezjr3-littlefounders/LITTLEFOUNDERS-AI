import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BoardLabel, LabelledDrawing } from '../BoardLabel';
import { centroidOf, measureMarks, nameFits, pathOf, viewBoxOf, type Frame, type MeasureMarks } from './netFrame';
import type { Measure, Pt } from './polynet.generated';

/** The pixels one unit of the net takes at its natural size; the figure shrinks to the width it is given and grows to a wider screen only so far. */
export const NET_SCALE = 26;
const NATURAL_WIDTH = { min: 220, max: 340 } as const;
const WIDEST = 460;
const TEXT_PX = 13;
/** A name is a board label: caption size, bold. Its width is estimated at this share of the size per letter. */
const NAME_PX = 14;
const LETTER = 0.6;
const LINE = 1.15;

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
  /** Present when the panel is a named part of the figure; absent for a plain drawing. It is a control only while `enabled`. */
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

/** The width the figure is drawn at, in px: what the board gives it, up to `widest`. The words on the panels are laid out against it. */
function useDrawnWidth(widest: number) {
  const host = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(widest);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    const read = () => { if (element.clientWidth > 0) setDrawn(element.clientWidth); };
    read();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    watch?.observe(element);
    return () => watch?.disconnect();
  }, []);
  return [host, drawn] as const;
}

/** Enter or Space on a drawn control is the tap on it: the click bubbles, so a carried chip is placed exactly as a pointer would place it. */
function press(event: KeyboardEvent<SVGGElement>) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** The numbers of a panel are SVG text; its name is a board label over the drawing, shown only when it fits, else the number (in a badge) stands in. */
function PanelDrawing({ panel, marks, font, word }: { panel: FigurePanel; marks: MeasureMarks; font: number; word: boolean }) {
  const centre = centroidOf(panel.points);
  return <>
    <polygon className="lf-poly-face" data-state={panel.state} points={pathOf(panel.points)} />
    {marks.guides.map((guide, at) => <line key={at} className="lf-poly-guide" x1={round(guide.from[0])} y1={round(-guide.from[1])} x2={round(guide.to[0])} y2={round(-guide.to[1])} />)}
    {word ? null : <circle className="lf-poly-badge" cx={round(centre[0])} cy={round(-centre[1])} r={round(font * 0.62)} />}
    {marks.labels.map((mark, at) => <text key={at} className="lf-poly-len" x={round(mark.at[0])} y={round(-mark.at[1] + font * 0.35)} fontSize={round(font)} textAnchor="middle">{mark.text}</text>)}
    {word ? null : <text className="lf-poly-name" x={round(centre[0])} y={round(-centre[1] + font * 0.35)} fontSize={round(font)} textAnchor="middle">{panel.number}</text>}
  </>;
}

/*
 * A flat net drawn from its panels: every panel is a polygon with the lengths written along its sides, a name or a number in the
 * middle and, when a hinge may be chosen, a thick line on the edge where a carried face can hang. A panel with a label is named for
 * assistive technology and is a control (role button, focusable, Enter or Space is a tap) only while it can be pressed; a panel with a
 * drop target also takes a carried chip. The drawing is the one picture of the net; the table beside it is its text equivalent.
 */
export function NetFigure({ frame, panels, hinges = [], sheet = null, label, role, drop }: {
  frame: Frame; panels: readonly FigurePanel[]; hinges?: readonly FigureHinge[]; sheet?: FigureSheet | null; label: string; role: 'img' | 'group';
  drop?: (id: string) => DropProps;
}) {
  const font = figureFont(frame);
  const widest = Math.min(WIDEST, Math.max(NATURAL_WIDTH.min, frame.width * NET_SCALE));
  const [host, drawn] = useDrawnWidth(widest);
  const scale = drawn / frame.width;
  const box = { width: frame.width, height: frame.height };
  const laid = panels.map((panel) => {
    const marks = measureMarks(panel.points, panel.measures, font * 0.7);
    const digits = Math.max(1, ...marks.labels.map((mark) => mark.text.length));
    const word = panel.name !== null && nameFits(panel.points, marks.labels.map((mark) => mark.at),
      { width: [...panel.name].length * LETTER * NAME_PX, height: NAME_PX * LINE }, { width: digits * LETTER * font * scale, height: font * scale }, scale);
    return { panel, marks, word };
  });
  /** A name that gave way to its number is still told, beside the drawing. */
  const keyed = laid.filter(({ panel, word }) => panel.name !== null && !word);
  return <div ref={host} className="lf-poly-fit" data-copy-role="data" style={{ inlineSize: `min(100%, ${round(widest)}px)` }}>
    <LabelledDrawing>
      <svg className="lf-poly-svg" viewBox={viewBoxOf(frame)} role={role} aria-label={label} focusable="false" data-copy-role="data"
        style={{ aspectRatio: `${round(frame.width)} / ${round(frame.height)}` }}>
        {sheet ? <rect className="lf-poly-sheet" x={round(sheet.x)} y={round(sheet.y)} width={round(sheet.width)} height={round(sheet.height)} /> : null}
        {laid.map(({ panel, marks, word }) => {
          const drag = panel.target && drop ? drop(panel.target) : {};
          const drawing = <PanelDrawing panel={panel} marks={marks} font={font} word={word} />;
          return <g key={panel.id} className="lf-poly" {...drag}>
            {panel.label === undefined ? drawing
              : panel.enabled
                ? <g className="lf-poly-button" role="button" tabIndex={0} aria-label={panel.label} data-state={panel.state} onClick={panel.onPress} onKeyDown={press}>{drawing}</g>
                : <g className="lf-poly-button" role="img" aria-label={panel.label} data-state={panel.state}>{drawing}</g>}
          </g>;
        })}
        {hinges.map((hinge) => <g key={hinge.id} className="lf-poly-hinge" role="button" tabIndex={0} aria-label={hinge.label} onKeyDown={press} {...(drop ? drop(hinge.id) : {})}>
          <line className="lf-poly-hinge-hit" x1={round(hinge.from[0])} y1={round(hinge.from[1])} x2={round(hinge.to[0])} y2={round(hinge.to[1])} strokeWidth={round(font * 2)} />
          <line className="lf-poly-hinge-line" x1={round(hinge.from[0])} y1={round(hinge.from[1])} x2={round(hinge.to[0])} y2={round(hinge.to[1])} strokeWidth={round(font * 0.5)} />
        </g>)}
      </svg>
      {laid.filter(({ word }) => word).map(({ panel }) => {
        const centre = centroidOf(panel.points);
        const xs = panel.points.map((point) => point[0]);
        return <BoardLabel key={panel.id} x={centre[0] - frame.x} y={-centre[1] - frame.y} box={box} room={Math.max(...xs) - Math.min(...xs)}>{panel.name}</BoardLabel>;
      })}
    </LabelledDrawing>
    {keyed.length ? <p className="lf-poly-key">{keyed.map(({ panel }) => <span key={panel.id}><b>{panel.number}</b> {panel.name}</span>)}</p> : null}
  </div>;
}
