import type { CSSProperties, ReactNode } from 'react';
import './boardLabel.css';

/** The drawing's own coordinate space (its viewBox size): a label's `x` and `y` are measured in it. */
export interface BoardBox { readonly width: number; readonly height: number }

export interface BoardLabelProps {
  x: number;
  y: number;
  box: BoardBox;
  /** Which edge of the text sits at `x`. */
  align?: 'start' | 'middle' | 'end';
  /** Which edge of the text sits at `y`. */
  valign?: 'top' | 'middle' | 'bottom';
  /** Widest the text may grow, in drawing units; longer text wraps. */
  room?: number;
  muted?: boolean;
  children: ReactNode;
}

const SHIFT = { start: '0%', middle: '-50%', end: '-100%', top: '0%', bottom: '-100%' } as const;

/**
 * A word on a board (Frontend Bible 05 section 5): HTML laid over the drawing, never SVG text, because a word grows in
 * translation and SVG text does not wrap. SVG text stays for short numerals and symbols. Put it inside a `lf-hz-drawing`
 * host that wraps the SVG, so the percentages below resolve against the drawing and the label follows it when it scales.
 */
export function BoardLabel({ x, y, box, align = 'middle', valign = 'middle', room, muted, children }: BoardLabelProps) {
  const style: CSSProperties = {
    left: `${x / box.width * 100}%`,
    top: `${y / box.height * 100}%`,
    transform: `translate(${SHIFT[align]}, ${SHIFT[valign === 'middle' ? 'middle' : valign]})`,
    ...(room !== undefined ? { maxInlineSize: `${Math.max(0, room) / box.width * 100}%` } : {}),
  };
  return <span className={`lf-hz-label${muted ? ' lf-hz-label--muted' : ''}`} data-copy-role="data" data-align={align} style={style}>{children}</span>;
}

/** The host a drawing and its labels share: it takes the SVG's size and is the box the labels are positioned in. */
export function LabelledDrawing({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`lf-hz-drawing${className ? ` ${className}` : ''}`} data-copy-role="data">{children}</div>;
}
