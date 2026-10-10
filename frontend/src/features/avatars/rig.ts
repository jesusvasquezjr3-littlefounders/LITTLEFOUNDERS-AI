/*
 * The rig of a character avatar: it moves the named parts of an avatar SVG (src/features/avatars/assets, made by
 * tools/avatars/parts.py) from a handful of numbers. It knows nothing about React, time or the pointer: give it a
 * `Frame` and it sets `transform`, `opacity` and path data. docs/design/CHARACTER-AVATARS.md describes the parts.
 *
 * What moves, and how it reads on a face:
 *  - Brows: each side lifts and tilts on its own, and both squeeze toward the center and drop (a frown), so surprise,
 *    anger, worry and doubt each have their own brows.
 *  - Eyes: each side opens, narrows (a squint) or widens (showing more white) on its own, slants (angry or sad), and
 *    the pupil dilates or contracts. The gaze moves inside the eye.
 *  - Nose: it wrinkles (lifts, with fold lines) for disgust and annoyance; nostrils flare.
 *  - Mouth: its outline is bent point by point: smile or frown (the corners), a one-sided smirk, an "O", pressed lips,
 *    width and opening. Speech sets the opening and width on top of the expression.
 *  - Cheeks: they rise and blush with a smile.
 *  - The head: it turns (a parallax: features slide by their depth, hair the other way), tilts, nods, leans in and
 *    bounces; the hair and crest swing a little behind it.
 * Every motion is a 2D transform or a path edit of a named part, so a frame is a few dozen attribute writes.
 */

export interface RigEye {
  parts: string[];
  /** The parts that move inside the eye to look somewhere (iris, pupil, glints). */
  gaze: string[];
  /** The parts that grow or shrink with the pupil (the iris and pupil, not the white). */
  pupil?: string[];
  center: [number, number];
  /** How far the gaze parts may travel, in the avatar's own units. */
  range: number;
  side: -1 | 1;
}

export interface RigSpec {
  prefix: string;
  viewBox: [number, number, number, number];
  /** The face the character wears when it is just being itself, under every expression (a gentle smile). */
  baseline?: Partial<Frame>;
  /** Scales every unit-based motion (turns, brow lifts, bounces): faces that take up less of the drawing need more. */
  gain?: number;
  eyes: RigEye[];
  brows: { part: string; center: [number, number]; side: -1 | 1 }[];
  face: { parts: string[]; depth: number }[];
  nose?: { parts: string[]; lines: string[]; flare: string[]; center: [number, number] };
  mouth: {
    parts: string[];
    anchor: [number, number];
    /** Half the width of the resting mouth, in units; sets how far the corners are from the center. */
    halfWidth: number;
    /** How far a full smile lifts the corners; defaults to a third of the half width. */
    reach?: number;
    /** Parts bent by smile and width but not opened or closed (a smile line that stays a line). */
    fixed?: string[];
    rest: { sx: number; sy: number };
    open: { sx: number; sy: number };
    /** Parts that follow the mouth: a mustache lifts when the mouth opens and rides up with a smile. */
    follow?: { part: string; open: number; smile: number; stretch: number }[];
  };
  cheeks: string[];
  head: { pivot: [number, number]; parts: string[] };
  body: string[];
}

/** Everything that can change from one frame to the next. Neutral is 0, except where noted. */
export interface Frame {
  /** Where the eyes look, each from -1 (left, up) to 1 (right, down). */
  lookX: number;
  lookY: number;
  /** The head turns without the eyes moving, -1 to 1. */
  turn: number;
  /** 0 open, 1 closed, per eye. */
  blinkL: number;
  blinkR: number;
  /** Eye opening per eye; 1 is neutral, under 1 squints, over 1 widens. */
  eyeOpenL: number;
  eyeOpenR: number;
  /** Eye slant: positive is angry (inner corners down), negative is sad (outer corners down). */
  eyeTilt: number;
  /** Pupil size; 1 is neutral. */
  pupil: number;
  /** Brows, per side: lift -1 to 1, tilt -1 (inner corners up, sad) to 1 (inner corners down, angry). */
  browLiftL: number;
  browLiftR: number;
  browTiltL: number;
  browTiltR: number;
  /** Both brows toward the center and down: a frown, 0 to 1. */
  browSqueeze: number;
  noseWrinkle: number;
  /** 0 closed to 1 fully open. */
  mouthOpen: number;
  /** Mouth width multiplier; 1 is neutral. */
  mouthWide: number;
  /** -1 frown, 1 smile. */
  smile: number;
  /** -1 left corner lifts, 1 right corner lifts: a smirk. */
  smirk: number;
  /** A round "O", 0 to 1. */
  pucker: number;
  /** Lips pressed, 0 to 1. */
  press: number;
  /** Strength of the blush; 0 is neutral, positive deepens it. */
  cheek: number;
  /** Head tilt in degrees. */
  tilt: number;
  /** Breathing, -1 to 1. */
  breath: number;
  /** A nod, 0 to 1 and back; the head dips. */
  nod: number;
  /** The head leans toward the viewer, 0 to 1. */
  lean: number;
  /** A bounce, 0 to 1 and back. */
  bounce: number;
  /** The head is thrown back or drawn down, -1 to 1 (laughing, shame). */
  lift: number;
}

export const NEUTRAL_FRAME: Frame = {
  lookX: 0, lookY: 0, turn: 0, blinkL: 0, blinkR: 0, eyeOpenL: 1, eyeOpenR: 1, eyeTilt: 0, pupil: 1,
  browLiftL: 0, browLiftR: 0, browTiltL: 0, browTiltR: 0, browSqueeze: 0, noseWrinkle: 0,
  mouthOpen: 0, mouthWide: 1, smile: 0, smirk: 0, pucker: 0, press: 0, cheek: 0,
  tilt: 0, breath: 0, nod: 0, lean: 0, bounce: 0, lift: 0,
};

/** Parallax in avatar units for a turn of 1; scaled to the avatar's width. */
const PARALLAX = 0.02;

interface PathEdit {
  node: SVGPathElement;
  commands: string[];
  points: number[];
}

const NUMBER = /-?\d*\.?\d+(?:e-?\d+)?/gi;

const ARGS = new Map<string, number>([['M', 2], ['L', 2], ['C', 6], ['Q', 4], ['Z', 0]]);

/** Reads an absolute path (M, L, C, Q, Z only) into commands and the list of its coordinates. */
interface ParsedPath { commands: string[]; points: number[] }

function parsePath(d: string): ParsedPath {
  const commands: string[] = [];
  const points: number[] = [];

  for (const segment of d.match(/[MLCQZ][^MLCQZ]*/g) ?? []) {
    commands.push(segment.slice(0, 1));

    for (const number of segment.slice(1).match(NUMBER) ?? []) points.push(Number(number));
  }

  return { commands, points };
}

function writePath(commands: string[], points: number[]): string {
  let at = 0;
  let out = '';

  for (const command of commands) {
    const count = ARGS.get(command) ?? 0;

    out += command + points.slice(at, at + count).map((value) => value.toFixed(1)).join(' ');
    at += count;
  }

  return out;
}

export class AvatarRig {
  private readonly elements = new Map<string, SVGGraphicsElement>();
  private readonly pieces = new Map<string, string[]>();
  private readonly edits = new Map<string, PathEdit[]>();
  private readonly root: SVGGElement;
  private readonly unit: number;

  constructor(private readonly svg: SVGSVGElement, private readonly spec: RigSpec) {
    const children = [...svg.children].filter((node) => node.tagName.toLowerCase() !== 'defs');
    // a head thrown back, a lean or a bounce may leave the drawing's box, and must not be cut at its edge
    svg.style.overflow = 'visible';

    const existing = svg.querySelector<SVGGElement>(':scope > g[data-rig-root]');

    if (existing) this.root = existing;
    else {
      this.root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.root.setAttribute('data-rig-root', '');
      children.forEach((node) => this.root.appendChild(node));
      svg.appendChild(this.root);
    }

    this.unit = spec.viewBox[2] * PARALLAX * (spec.gain ?? 1);
  }

  private element(part: string): SVGGraphicsElement | null {
    let found = this.elements.get(part);

    if (!found) {
      found = this.svg.querySelector<SVGGraphicsElement>(`[id="${this.spec.prefix}${part}"]`) ?? undefined;

      if (found) this.elements.set(part, found);
    }

    return found ?? null;
  }

  private add(part: string, piece: string) {
    const list = this.pieces.get(part);

    if (list) list.push(piece);
    else this.pieces.set(part, [piece]);
  }

  private readonly centers = new Map<string, [number, number]>();

  /** A transform that scales a part about its own center. */
  private scaleAbout(part: string, sx: number, sy: number): string {
    let center = this.centers.get(part);

    if (!center) {
      const box = this.element(part)?.getBBox();

      center = box ? [box.x + box.width / 2, box.y + box.height / 2] : [0, 0];
      this.centers.set(part, center);
    }

    return `translate(${center[0].toFixed(1)} ${center[1].toFixed(1)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${(-center[0]).toFixed(1)} ${(-center[1]).toFixed(1)})`;
  }

  /** The editable paths inside a part, read once. */
  private paths(part: string): PathEdit[] {
    let found = this.edits.get(part);

    if (!found) {
      found = [];

      const group = this.element(part);

      for (const node of group?.querySelectorAll<SVGPathElement>('path') ?? []) {
        const { commands, points } = parsePath(node.getAttribute('d') ?? '');

        if (points.length) found.push({ node, commands, points });
      }

      this.edits.set(part, found);
    }

    return found;
  }

  /** Draws one frame. Cheap enough to call on every animation frame. */
  apply(frame: Frame) {
    const { spec, unit } = this;

    this.pieces.clear();

    // only an expression or a gesture turns the head; where the eyes look moves the iris inside the eye and nothing else
    const shift = (depth: number): string => `translate(${(frame.turn * depth * unit).toFixed(2)} 0)`;

    // the face features slide with the turn, by depth; the hair and crest slide the other way and swing behind
    for (const group of spec.face) for (const part of group.parts) this.add(part, shift(group.depth));

    const [px, py] = spec.head.pivot;

    for (const part of spec.head.parts) {
      this.add(part, shift(-0.4));
      this.add(part, `rotate(${(-frame.tilt * 0.5 - frame.turn * 1.2).toFixed(2)} ${px} ${py})`);
    }

    // eyes: each opens, squints or widens on its own, slants, and looks; the pupil dilates
    for (const eye of spec.eyes) {
      const [cx, cy] = eye.center;
      const blink = eye.side < 0 ? frame.blinkL : frame.blinkR;
      const wide = eye.side < 0 ? frame.eyeOpenL : frame.eyeOpenR;
      // a squint narrows the eye only part of the way, so the eye never collapses into a slit unless it blinks
      const lid = wide < 1 ? 1 - (1 - wide) * 0.55 : wide;
      const open = Math.max(0.04, lid * (1 - blink * 0.96));
      const grow = wide > 1 ? 1 + (wide - 1) * 0.22 : 1;
      const slant = (-eye.side * frame.eyeTilt * 7).toFixed(2);
      const squash = `translate(${cx} ${cy}) rotate(${slant}) scale(${grow.toFixed(3)} ${(open * grow).toFixed(3)}) translate(${-cx} ${-cy})`;

      for (const part of eye.parts) {
        this.add(part, shift(0.9));
        this.add(part, squash);
      }

      const gx = (frame.lookX * eye.range).toFixed(2);
      const gy = (frame.lookY * eye.range * 0.8).toFixed(2);

      for (const part of eye.gaze) this.add(part, `translate(${gx} ${gy})`);

      for (const part of eye.pupil ?? []) {
        this.add(part, this.scaleAbout(part, frame.pupil, frame.pupil));
      }
    }

    // brows: lift, tilt, and the squeeze of a frown
    for (const brow of spec.brows) {
      const [cx, cy] = brow.center;
      const lift = brow.side < 0 ? frame.browLiftL : frame.browLiftR;
      const tilt = brow.side < 0 ? frame.browTiltL : frame.browTiltR;
      const dx = (-brow.side * frame.browSqueeze * unit * 1.6).toFixed(2);
      const dy = (-lift * unit * 1.5 + frame.browSqueeze * unit * 0.7).toFixed(2);

      this.add(brow.part, shift(0.95));
      this.add(brow.part, `translate(${dx} ${dy}) rotate(${(-tilt * brow.side * 14).toFixed(2)} ${cx} ${cy})`);
    }

    // nose: it lifts and folds when wrinkled; the nostrils flare
    if (spec.nose) {
      const { parts, lines, flare, center } = spec.nose;
      const w = frame.noseWrinkle;

      for (const part of parts) {
        this.add(part, shift(1.25));
        this.add(part, `translate(0 ${(-w * unit * 0.9).toFixed(2)}) translate(${center[0]} ${center[1]}) scale(${(1 + w * 0.06).toFixed(3)} ${(1 - w * 0.1).toFixed(3)}) translate(${-center[0]} ${-center[1]})`);
      }

      for (const part of lines) {
        this.add(part, shift(1.25));
        this.element(part)?.setAttribute('opacity', Math.min(1, w * 1.3).toFixed(2));
      }

      for (const part of flare) {
        this.add(part, this.scaleAbout(part, 1 + w * 0.4, 1 + w * 0.25));
      }
    }

    // mouth: every point of every mouth path is moved, so the outline bends instead of just scaling
    this.mouth(frame, shift);

    // cheeks rise and swell with a smile
    for (const part of spec.cheeks) {
      const up = Math.max(0, frame.smile);

      this.add(part, shift(0.7));
      this.add(part, `translate(0 ${(-up * unit * 0.8).toFixed(2)})`);
      this.add(part, this.scaleAbout(part, 1 + up * 0.14 + frame.cheek * 0.08, 1 + up * 0.14 + frame.cheek * 0.08));
      this.element(part)?.setAttribute('opacity', Math.max(0, Math.min(1, 0.75 + frame.cheek * 0.5 + up * 0.25)).toFixed(2));
    }

    // breathing: the body rises and falls a hair
    for (const part of spec.body) this.add(part, `translate(0 ${(frame.breath * unit * 0.12 + frame.bounce * unit * 0.2).toFixed(2)})`);

    for (const [part, list] of this.pieces) this.element(part)?.setAttribute('transform', list.join(' '));

    const ox = spec.viewBox[0] + spec.viewBox[2] / 2;
    const oy = spec.viewBox[1] + spec.viewBox[3];
    const roll = (frame.tilt + frame.nod * 3 + frame.turn * 3 - frame.lift * 4) * 0.6;
    const dip = frame.nod * unit * 0.9 - frame.bounce * unit * 1.8 + frame.lift * unit * 0.5;
    const grow = 1 + frame.lean * 0.04 + frame.bounce * 0.01;

    this.root.setAttribute('transform', `translate(${ox} ${oy}) scale(${grow.toFixed(3)}) translate(${-ox} ${-oy}) rotate(${roll.toFixed(2)} ${px} ${py}) translate(0 ${dip.toFixed(2)})`);
  }

  private mouth(frame: Frame, shift: (depth: number) => string) {
    const { mouth } = this.spec;
    const [ax, ay] = mouth.anchor;
    const o = Math.max(0, Math.min(1.2, frame.mouthOpen));
    const sx = (mouth.rest.sx + (mouth.open.sx - mouth.rest.sx) * o) * frame.mouthWide * (1 - 0.45 * frame.pucker) * (1 + 0.04 * frame.press);
    const sy = (mouth.rest.sy + (mouth.open.sy - mouth.rest.sy) * o) * (1 + 0.5 * frame.pucker) * (1 - 0.55 * frame.press);

    const reach = mouth.reach ?? mouth.halfWidth * 0.34;

    const bend = (parts: string[], scaleX: number, scaleY: number) => {
      for (const part of parts) {
        this.add(part, shift(1.05));

        for (const edit of this.paths(part)) {
          const next = Array.from({ length: edit.points.length }, () => 0);

          for (let i = 0; i < edit.points.length; i += 2) {
            const x = ax + ((edit.points[i] ?? 0) - ax) * scaleX;
            let y = ay + ((edit.points[i + 1] ?? 0) - ay) * scaleY;
            const u = (x - ax) / (mouth.halfWidth * Math.max(0.4, scaleX));
            const side = Math.min(1, Math.abs(u)) ** 2;

            y -= frame.smile * reach * side;
            y -= frame.smirk * reach * 0.9 * (u > 0 ? side * 1.6 : -side * 0.5);
            next[i] = x;
            next[i + 1] = y;
          }

          edit.node.setAttribute('d', writePath(edit.commands, next));
        }
      }
    };

    bend(mouth.parts, sx, sy);
    bend(mouth.fixed ?? [], frame.mouthWide * (1 - 0.3 * frame.pucker), 1 - 0.35 * frame.press);

    for (const follow of mouth.follow ?? []) {
      const lift = follow.open * o + follow.smile * frame.smile;

      this.add(follow.part, `translate(0 ${lift.toFixed(2)}) translate(${ax} ${ay}) scale(${(1 + follow.stretch * frame.smile).toFixed(3)} 1) translate(${-ax} ${-ay})`);
    }
  }
}
