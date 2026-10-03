/*
 * Where the place names sit on the globe. A name is HTML laid over the drawing (BoardLabel), so it keeps its 14 px size and
 * wraps when a translation is long; that means it has to be put somewhere it does not cover another name, a route tag, a
 * place dot or a route line. Eight spots around each dot are tried, the cheapest wins, and the answer is worked out again
 * every time the globe turns, because a turn moves the dots.
 */
export type LabelAlign = 'start' | 'middle' | 'end';
export type LabelValign = 'top' | 'middle' | 'bottom';

export interface LabelDot { readonly id: string; readonly text: string; readonly x: number; readonly y: number }
export interface Point { readonly x: number; readonly y: number }
export interface PlacedLabel { readonly id: string; readonly text: string; readonly x: number; readonly y: number; readonly align: LabelAlign; readonly valign: LabelValign; readonly room: number }

interface Rect { left: number; top: number; right: number; bottom: number }
interface Spot { readonly align: LabelAlign; readonly valign: LabelValign; readonly dx: number; readonly dy: number }

/* The drawing renders at 288 px wide on the narrowest phone for 240 units: 1.2 px a unit. The names are 14 px bold, about 0.6 em a letter. */
const PX_PER_UNIT = 1.2;
const CHAR = 0.6 * 14 / PX_PER_UNIT;
const SPACE = 0.3 * 14 / PX_PER_UNIT;
const LINE = 1.15 * 14 / PX_PER_UNIT;
const EDGE = 2;
const GAP = 6;
const NEAR = GAP - 2;
const MAX_ROOM = 96;
const MIN_ROOM = 28;
const DOT = 4.5;

const SPOTS: readonly Spot[] = [
  { align: 'start', valign: 'middle', dx: GAP, dy: 0 },
  { align: 'end', valign: 'middle', dx: -GAP, dy: 0 },
  { align: 'middle', valign: 'bottom', dx: 0, dy: -GAP },
  { align: 'middle', valign: 'top', dx: 0, dy: GAP },
  { align: 'start', valign: 'bottom', dx: NEAR, dy: -NEAR },
  { align: 'start', valign: 'top', dx: NEAR, dy: NEAR },
  { align: 'end', valign: 'bottom', dx: -NEAR, dy: -NEAR },
  { align: 'end', valign: 'top', dx: -NEAR, dy: NEAR },
];

const overlap = (a: Rect, b: Rect): number =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** How wide and how tall a name is once it wraps in `room` units, and whether one of its words is wider than the room. */
function measure(text: string, room: number): { width: number; height: number; lines: number; broken: boolean } {
  let lines = 1;
  let line = 0;
  let widest = 0;
  let longest = 0;
  for (const word of text.split(' ')) {
    const w = word.length * CHAR;
    longest = Math.max(longest, w);
    if (line > 0 && line + SPACE + w > room) { widest = Math.max(widest, line); lines += 1; line = w; } else line = line > 0 ? line + SPACE + w : w;
  }
  widest = Math.max(widest, line);
  return { width: Math.min(Math.max(widest, longest), Math.max(room, longest)), height: lines * LINE, lines, broken: longest > room };
}

export function layoutLabels(size: number, dots: readonly LabelDot[], tags: readonly Point[], marks: readonly Point[]): PlacedLabel[] {
  const dotRects: Rect[] = dots.map((dot) => ({ left: dot.x - DOT, top: dot.y - DOT, right: dot.x + DOT, bottom: dot.y + DOT }));
  const tagRects: Rect[] = tags.map((tag) => ({ left: tag.x - 10, top: tag.y - 10, right: tag.x + 10, bottom: tag.y + 10 }));
  const placed: Rect[] = [];
  const out: PlacedLabel[] = [];
  for (const dot of dots) {
    let best: { cost: number; label: PlacedLabel; rect: Rect } | null = null;
    for (const [index, spot] of SPOTS.entries()) {
      const x = dot.x + spot.dx;
      const y = dot.y + spot.dy;
      const available = spot.align === 'start' ? size - EDGE - x : spot.align === 'end' ? x - EDGE : 2 * Math.min(x - EDGE, size - EDGE - x);
      const room = Math.min(MAX_ROOM, available);
      if (room < MIN_ROOM) continue;
      const box = measure(dot.text, room);
      const left = spot.align === 'start' ? x : spot.align === 'end' ? x - box.width : x - box.width / 2;
      const top = spot.valign === 'top' ? y : spot.valign === 'bottom' ? y - box.height : y - box.height / 2;
      const rect: Rect = { left, top, right: left + box.width, bottom: top + box.height };
      let cost = index * 0.5 + (box.lines - 1) * 60 + (box.broken ? 400 : 0);
      if (rect.top < EDGE || rect.bottom > size - EDGE) cost += 5000;
      for (const other of dotRects) cost += overlap(rect, other) * 3;
      for (const other of tagRects) cost += overlap(rect, other) * 3;
      for (const other of placed) cost += overlap(rect, other) * 4;
      for (const mark of marks) if (mark.x >= rect.left && mark.x <= rect.right && mark.y >= rect.top && mark.y <= rect.bottom) cost += 14;
      if (!best || cost < best.cost) best = { cost, rect, label: { id: dot.id, text: dot.text, x, y, align: spot.align, valign: spot.valign, room } };
    }
    if (best) { placed.push(best.rect); out.push(best.label); } else out.push({ id: dot.id, text: dot.text, x: dot.x + GAP, y: dot.y, align: 'start', valign: 'middle', room: MIN_ROOM });
  }
  return out;
}

/* A route's letter sits on its line, at the middle. On a short route the middle is on top of a place dot, so the tag slides along the line or steps to its side. */
export interface TagRoute { readonly id: string; readonly at: (t: number) => Point | null }
export interface PlacedTag extends Point { readonly id: string }

const TAG_ALONG = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74] as const;
const TAG_SIDE = [0, 1, -1] as const;
const TAG_OFFSET = 13;
const TAG_CLEAR_DOT = 14;
const TAG_CLEAR_TAG = 20;

export function placeTags(size: number, radius: number, routes: readonly TagRoute[], dots: readonly Point[]): PlacedTag[] {
  const out: PlacedTag[] = [];
  for (const route of routes) {
    if (!route.at(0.5)) continue;
    let best: { cost: number; at: Point } | null = null;
    for (const t of TAG_ALONG) {
      const on = route.at(t);
      const before = route.at(t - 0.02);
      const after = route.at(t + 0.02);
      if (!on || !before || !after) continue;
      const run = Math.hypot(after.x - before.x, after.y - before.y) || 1;
      for (const side of TAG_SIDE) {
        const at = { x: on.x - (after.y - before.y) / run * side * TAG_OFFSET, y: on.y + (after.x - before.x) / run * side * TAG_OFFSET };
        if (Math.hypot(at.x - size / 2, at.y - size / 2) > radius - 9) continue;
        let cost = Math.abs(t - 0.5) * 40 + Math.abs(side) * 6;
        for (const dot of dots) cost += Math.max(0, TAG_CLEAR_DOT - Math.hypot(at.x - dot.x, at.y - dot.y)) * 12;
        for (const tag of out) cost += Math.max(0, TAG_CLEAR_TAG - Math.hypot(at.x - tag.x, at.y - tag.y)) * 12;
        if (!best || cost < best.cost) best = { cost, at };
      }
    }
    const middle = route.at(0.5)!;
    out.push({ id: route.id, ...(best ? best.at : middle) });
  }
  return out;
}
