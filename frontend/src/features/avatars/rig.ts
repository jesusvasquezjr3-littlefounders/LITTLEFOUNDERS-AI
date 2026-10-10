/*
 * The rig of a character avatar: it moves the named parts of an avatar SVG (src/features/avatars/assets, made by
 * tools/avatars/parts.py) from a handful of numbers. It knows nothing about React, time or the pointer: give it a
 * `Frame` and it sets `transform` and `opacity` attributes. docs/design/CHARACTER-AVATARS.md describes the parts.
 *
 * Every motion is a 2D transform of one named part, so a frame costs a few dozen attribute writes and no layout.
 * Turning the head is a parallax: the features shift by their depth, the hair and crest the other way, and the whole
 * avatar tilts a little. It reads as a turn of a few degrees, not as a full rotation.
 */

export interface RigEye {
  parts: string[];
  /** The parts that move inside the eye to look somewhere (iris, pupil, glints). */
  gaze: string[];
  center: [number, number];
  /** How far the gaze parts may travel, in the avatar's own units. */
  range: number;
}

export interface RigSpec {
  prefix: string;
  viewBox: [number, number, number, number];
  eyes: RigEye[];
  brows: { part: string; center: [number, number]; side: -1 | 1 }[];
  face: { parts: string[]; depth: number }[];
  mouth: {
    parts: string[];
    anchor: [number, number];
    rest: { sx: number; sy: number };
    open: { sx: number; sy: number };
    lift?: { part: string; dy: number };
  };
  cheeks: string[];
  head: { pivot: [number, number]; parts: string[] };
  body: string[];
}

/** Everything that can change from one frame to the next. Every value is neutral at 0, except where noted. */
export interface Frame {
  /** Where the avatar looks, each from -1 (left, up) to 1 (right, down). */
  lookX: number;
  lookY: number;
  /** 0 open, 1 closed. */
  blink: number;
  /** Eye opening multiplier; 1 is neutral. */
  eyeOpen: number;
  browLift: number;
  browTilt: number;
  /** 0 closed to 1 fully open. */
  mouthOpen: number;
  /** Mouth width multiplier; 1 is neutral. */
  mouthWide: number;
  /** Strength of the blush; 0 is neutral, positive deepens it. */
  cheek: number;
  /** Head tilt in degrees. */
  tilt: number;
  /** Breathing, -1 to 1. */
  breath: number;
  /** A nod, 0 to 1 and back. */
  nod: number;
}

export const NEUTRAL_FRAME: Frame = { lookX: 0, lookY: 0, blink: 0, eyeOpen: 1, browLift: 0, browTilt: 0, mouthOpen: 0, mouthWide: 1, cheek: 0, tilt: 0, breath: 0, nod: 0 };

/** Parallax in avatar units for a look of 1; scaled to the avatar's width. */
const PARALLAX = 0.03;

type Piece = string;

export class AvatarRig {
  private readonly elements = new Map<string, SVGGraphicsElement>();
  private readonly pieces = new Map<string, Piece[]>();
  private readonly root: SVGGElement;
  private readonly unit: number;

  constructor(private readonly svg: SVGSVGElement, private readonly spec: RigSpec) {
    const children = [...svg.children].filter((node) => node.tagName.toLowerCase() !== 'defs');

    const existing = svg.querySelector<SVGGElement>(':scope > g[data-rig-root]');

    if (existing) this.root = existing;
    else {
      this.root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.root.setAttribute('data-rig-root', '');
      children.forEach((node) => this.root.appendChild(node));
      svg.appendChild(this.root);
    }

    this.unit = spec.viewBox[2] * PARALLAX;
  }

  private element(part: string): SVGGraphicsElement | null {
    let found = this.elements.get(part);

    if (!found) {
      found = this.svg.querySelector<SVGGraphicsElement>(`[id="${this.spec.prefix}${part}"]`) ?? undefined;

      if (found) this.elements.set(part, found);
    }

    return found ?? null;
  }

  private add(part: string, piece: Piece) {
    const list = this.pieces.get(part);

    if (list) list.push(piece);
    else this.pieces.set(part, [piece]);
  }

  /** Draws one frame. Cheap enough to call on every animation frame. */
  apply(frame: Frame) {
    const { spec, unit } = this;

    this.pieces.clear();

    const look = { x: frame.lookX, y: frame.lookY };
    const shift = (depth: number): Piece => `translate(${(look.x * depth * unit).toFixed(2)} ${(look.y * depth * unit * 0.7).toFixed(2)})`;

    // the face features slide with the look, by depth; the hair and crest slide the other way
    for (const group of spec.face) for (const part of group.parts) this.add(part, shift(group.depth));

    for (const part of spec.head.parts) this.add(part, shift(-0.35));

    // eyes: blink and opening, then the gaze inside the eye
    for (const eye of spec.eyes) {
      const [cx, cy] = eye.center;
      const open = Math.max(0.04, frame.eyeOpen * (1 - frame.blink * 0.96));
      const scale = `translate(${cx} ${cy}) scale(1 ${open.toFixed(3)}) translate(${-cx} ${-cy})`;

      for (const part of eye.parts) {
        this.add(part, shift(0.9));
        this.add(part, scale);
      }

      const gx = (look.x * eye.range).toFixed(2);
      const gy = (look.y * eye.range * 0.8).toFixed(2);

      for (const part of eye.gaze) this.add(part, `translate(${gx} ${gy})`);
    }

    // brows
    for (const brow of spec.brows) {
      const [cx, cy] = brow.center;

      this.add(brow.part, shift(0.9));
      this.add(brow.part, `translate(0 ${(-frame.browLift * unit * 1.2).toFixed(2)}) rotate(${(frame.browTilt * brow.side * 11).toFixed(2)} ${cx} ${cy})`);
    }

    // mouth: it opens from its anchor and widens around it
    {
      const { rest, open, anchor, parts, lift } = spec.mouth;
      const o = Math.max(0, Math.min(1.2, frame.mouthOpen));
      const sx = (rest.sx + (open.sx - rest.sx) * o) * frame.mouthWide;
      const sy = rest.sy + (open.sy - rest.sy) * o;
      const [ax, ay] = anchor;
      const scale = `translate(${ax} ${ay}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-ax} ${-ay})`;

      for (const part of parts) this.add(part, scale);

      if (lift) this.add(lift.part, `translate(0 ${(lift.dy * o).toFixed(2)})`);
    }

    // breathing: the body rises and falls a hair; a nod dips the head
    for (const part of spec.body) this.add(part, `translate(0 ${(frame.breath * unit * 0.12).toFixed(2)})`);

    for (const [part, list] of this.pieces) {
      const node = this.element(part);

      if (node) node.setAttribute('transform', list.join(' '));
    }

    for (const part of spec.cheeks) this.element(part)?.setAttribute('opacity', Math.max(0, Math.min(1, 0.8 + frame.cheek * 0.5)).toFixed(2));

    const [px, py] = spec.head.pivot;

    this.root.setAttribute('transform', `rotate(${(frame.tilt + frame.nod * 3 + frame.lookX * 2.5).toFixed(2)} ${px} ${py}) translate(0 ${(frame.nod * unit * 0.9).toFixed(2)})`);
  }
}
