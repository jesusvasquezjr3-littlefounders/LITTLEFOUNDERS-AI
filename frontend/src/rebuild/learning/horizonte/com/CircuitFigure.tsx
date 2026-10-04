import type { GatesPayload } from './circuits.generated';
import { BoardLabel, LabelledDrawing } from '../BoardLabel';
import { CHAR_PX, blockOf } from './labelBlock';
import './circuitFigure.css';

/*
 * The wired circuit of the gates board: switches on the left, gates in columns by how many gates stand between them and a switch,
 * the lamp on the right. Every name is HTML over the drawing (Frontend Bible 05 section 5), 14 px wherever the board is, so the
 * drawing is laid out in CSS pixels, at scale one: a switch's name hangs above or below its pin, on the side its wires leave
 * away from, and a gate's name sits in its box. Only the "?" of a bare box is drawn in the SVG.
 */

const PIN_R = 5;
const PIN_X = PIN_R + 1;
const WIRE_IN = 26;
const WIRE = 22;
const WIRE_OUT = 20;
const LAMP_R = 7;
const BOX_H = 28;
const BOX_MIN_W = 48;
const PITCH = 52;
const GATE_GAP = 10;
const NAME_GAP = 4;
const NAME_WIDE = 96;
const MARGIN = 3;

interface Point { x: number; y: number }
interface Box { x0: number; y0: number; x1: number; y1: number }

/** Keeps `gap` between neighbours by moving each pair apart about its middle; the order stays. */
function spreadApart(ys: readonly number[], gap: number): number[] {
  const order = ys.map((_, index) => index).sort((a, b) => ys[a]! - ys[b]! || a - b);
  const out = [...ys];
  for (let pass = 0; pass < 6; pass += 1) {
    for (let at = 1; at < order.length; at += 1) {
      const upper = order[at - 1]!;
      const lower = order[at]!;
      const deficit = gap - (out[lower]! - out[upper]!);
      if (deficit > 0) { out[upper]! -= deficit / 2; out[lower]! += deficit / 2; }
    }
  }
  return out;
}

export interface CircuitFigureProps {
  gates: GatesPayload; labels: Readonly<Record<string, string>>; aria: string;
  slotName: (id: string) => string; gateName: (piece: string) => string; assigned: Readonly<Record<string, string>>;
}

export function CircuitFigure({ gates, labels, aria, slotName, gateName, assigned }: CircuitFigureProps) {
  const last = gates.slots[gates.slots.length - 1]!;
  const inputNames = gates.inputs.map((id) => labels[id] ?? id);
  const lampName = labels[last.id] ?? slotName(last.id);
  const boxW = Math.max(BOX_MIN_W, ...gates.pieces.map((piece) => gateName(piece.id).length * CHAR_PX + 12));
  const nameBlocks = inputNames.map((name) => blockOf(name, undefined, NAME_WIDE));
  const lampBlock = blockOf(lampName);

  const depth = new Map<string, number>(gates.inputs.map((id) => [id, 0]));
  for (const slot of gates.slots) depth.set(slot.id, 1 + Math.max(...slot.from.map((source) => depth.get(source)!)));
  const deepest = Math.max(...gates.slots.map((slot) => depth.get(slot.id)!));
  const columnX = (level: number) => PIN_X + PIN_R + WIRE_IN + boxW / 2 + (level - 1) * (boxW + WIRE);

  /* The first switch's name hangs above its pin, the others' below: a switch's wires leave downwards from the top one and upwards from the rest. */
  const point = new Map<string, Point>();
  let y = nameBlocks[0]!.h + PIN_R + NAME_GAP + MARGIN;
  gates.inputs.forEach((id, index) => {
    if (index > 0) y += Math.max(PITCH, index > 1 ? PIN_R * 2 + NAME_GAP * 2 + nameBlocks[index - 1]!.h : 0);
    point.set(id, { x: PIN_X, y });
  });
  for (let level = 1; level <= deepest; level += 1) {
    const here = gates.slots.filter((slot) => depth.get(slot.id) === level);
    const wanted = here.map((slot) => slot.from.reduce((sum, source) => sum + point.get(source)!.y, 0) / slot.from.length);
    const settled = spreadApart(wanted, BOX_H + GATE_GAP);
    here.forEach((slot, index) => point.set(slot.id, { x: columnX(level), y: settled[index]! }));
  }
  const out = point.get(last.id)!;
  const lamp = { x: columnX(deepest) + boxW / 2 + WIRE_OUT + LAMP_R, y: out.y };
  const edgeOf = (source: string) => (gates.inputs.includes(source) ? PIN_R : boxW / 2);

  const boxes = gates.slots.map((slot): Box => {
    const at = point.get(slot.id)!;
    return { x0: at.x - boxW / 2, y0: at.y - BOX_H / 2, x1: at.x + boxW / 2, y1: at.y + BOX_H / 2 };
  });
  /* A name clears the pin; where a gate's box stands in the way (a gate reading only this switch sits level with it), it clears the box too. */
  const names = gates.inputs.map((id, index): Box => {
    const at = point.get(id)!;
    const block = nameBlocks[index]!;
    const above = index === 0;
    let top = above ? at.y - PIN_R - NAME_GAP - block.h : at.y + PIN_R + NAME_GAP;
    for (const box of boxes) {
      if (at.x - PIN_R >= box.x1 || at.x - PIN_R + block.w <= box.x0 || top >= box.y1 || top + block.h <= box.y0) continue;
      top = above ? box.y0 - NAME_GAP - block.h : box.y1 + NAME_GAP;
    }
    return { x0: at.x - PIN_R, y0: top, x1: at.x - PIN_R + block.w, y1: top + block.h };
  });
  const lampLabel: Box = { x0: lamp.x + LAMP_R - lampBlock.w, y0: lamp.y - BOX_H / 2 - NAME_GAP - lampBlock.h, x1: lamp.x + LAMP_R, y1: lamp.y - BOX_H / 2 - NAME_GAP };
  const everything: Box[] = [...names, lampLabel, ...boxes, ...gates.inputs.map((id): Box => ({ x0: 0, y0: point.get(id)!.y - PIN_R, x1: PIN_X + PIN_R, y1: point.get(id)!.y + PIN_R })), { x0: 0, y0: lamp.y - LAMP_R, x1: lamp.x + LAMP_R, y1: lamp.y + LAMP_R }];
  const view = {
    x0: 0, y0: Math.min(...everything.map((box) => box.y0)) - MARGIN, x1: Math.max(...everything.map((box) => box.x1)) + MARGIN, y1: Math.max(...everything.map((box) => box.y1)) + MARGIN,
  };
  const size = { width: view.x1 - view.x0, height: view.y1 - view.y0 };
  const place = (box: Box, align: 'start' | 'end', valign: 'top' | 'bottom') => ({ x: (align === 'start' ? box.x0 : box.x1) - view.x0, y: (valign === 'top' ? box.y0 : box.y1) - view.y0 });

  return <div className="lf-circuit-frame">
    <div className="lf-circuit-sized" style={{ inlineSize: size.width }}>
      <LabelledDrawing>
        <svg viewBox={`${view.x0} ${view.y0} ${size.width} ${size.height}`} role="img" aria-label={aria} data-copy-role="data" focusable="false">
          {gates.slots.map((slot) => slot.from.map((source, index) => {
            const from = point.get(source)!;
            const to = point.get(slot.id)!;
            const spread = slot.from.length === 2 ? (index === 0 ? -5 : 5) : 0;
            const startX = from.x + edgeOf(source);
            const endX = to.x - boxW / 2;
            return <path key={`${slot.id}:${source}`} className="lf-circuit-wire" fill="none"
              d={`M${startX} ${from.y} C${(startX + endX) / 2 + 8} ${from.y} ${(startX + endX) / 2 - 8} ${to.y + spread} ${endX} ${to.y + spread}`} />;
          }))}
          <path className="lf-circuit-wire" fill="none" d={`M${out.x + boxW / 2} ${out.y} L${lamp.x - LAMP_R} ${lamp.y}`} />
          {gates.inputs.map((id) => <circle key={id} className="lf-circuit-pin" cx={point.get(id)!.x} cy={point.get(id)!.y} r={PIN_R} />)}
          {gates.slots.map((slot) => {
            const at = point.get(slot.id)!;
            const piece = assigned[slot.id];
            return <g key={slot.id}>
              <rect className={piece ? 'lf-circuit-box lf-circuit-box--set' : 'lf-circuit-box'} x={at.x - boxW / 2} y={at.y - BOX_H / 2} width={boxW} height={BOX_H} rx="4" />
              {piece ? null : <text className="lf-circuit-gate" x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central">?</text>}
            </g>;
          })}
          <circle className="lf-circuit-lamp" cx={lamp.x} cy={lamp.y} r={LAMP_R} />
        </svg>
        {gates.inputs.map((id, index) => {
          const at = place(names[index]!, 'start', index === 0 ? 'bottom' : 'top');
          return <BoardLabel key={id} x={at.x} y={at.y} box={size} align="start" valign={index === 0 ? 'bottom' : 'top'} room={nameBlocks[index]!.room + 2}>
            <span className="lf-circuit-name" style={{ maxInlineSize: `${nameBlocks[index]!.room / 14}em` }}>{inputNames[index]}</span>
          </BoardLabel>;
        })}
        {gates.slots.map((slot) => {
          const piece = assigned[slot.id];
          if (!piece) return null;
          const at = point.get(slot.id)!;
          return <BoardLabel key={slot.id} x={at.x - view.x0} y={at.y - view.y0} box={size} align="middle" valign="middle" room={boxW}>{gateName(piece)}</BoardLabel>;
        })}
        <BoardLabel x={lampLabel.x1 - view.x0} y={lampLabel.y1 - view.y0} box={size} align="end" valign="bottom" room={lampBlock.room + 2}>
          <span className="lf-circuit-name" style={{ maxInlineSize: `${lampBlock.room / 14}em` }}>{lampName}</span>
        </BoardLabel>
      </LabelledDrawing>
    </div>
  </div>;
}
