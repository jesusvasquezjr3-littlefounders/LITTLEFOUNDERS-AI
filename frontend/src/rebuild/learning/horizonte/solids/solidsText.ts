import type { Locale } from '../../../design/copyBudget';
import { copyText } from '../copyText';
import { SOLIDS_COPY } from './copy';
import type { SolidId } from './model.generated';
import type { FaceName } from './net.generated';
import { lengthsOf, shapeOf, type PanelShape } from './netFrame';
import type { PolyFace, PolyFaceName, PolyKind } from './polynet.generated';
import { PITCH_NAMES, type SolidView } from './projection.generated';

export type SolidsText = { readonly [K in keyof typeof SOLIDS_COPY]: string };

export const solidsText = (locale: Locale): SolidsText => copyText(SOLIDS_COPY, locale);

/** Fills named slots such as `{solid}` or `{c}`; an unknown slot stays as written. */
export const fill = (text: string, values: Readonly<Record<string, string | number>>): string =>
  text.replace(/\{(\w+)\}/g, (slot, key: string) => (key in values ? String(values[key]) : slot));

const SOLID_KEYS = { cube: 'solidCube', prism: 'solidPrism', pyramid: 'solidPyramid', cylinder: 'solidCylinder' } as const;
export const solidLabel = (t: SolidsText, solid: SolidId): string => t[SOLID_KEYS[solid]];

const FACE_KEYS = { top: 'faceTop', bottom: 'faceBottom', front: 'faceFront', back: 'faceBack', left: 'faceLeft', right: 'faceRight', slope: 'faceSlope' } as const;
/** A cube face name, or any face name of the other solids (a prism's slope too). */
export const faceLabel = (t: SolidsText, face: FaceName | PolyFaceName): string => t[FACE_KEYS[face]];

const KIND_KEYS = { 'rect-prism': 'solidBox', 'tri-prism': 'solidPrism', 'sq-pyramid': 'solidPyramid' } as const;
export const polyKindLabel = (t: SolidsText, kind: PolyKind): string => t[KIND_KEYS[kind]];

const SHAPE_KEYS = { rect: 'shapeRect', right: 'shapeRight', triangle: 'shapeTriangle' } as const;
export const shapeLabel = (t: SolidsText, shape: PanelShape): string => t[SHAPE_KEYS[shape]];

const LENGTH_KEYS = { rect: 'lengthsRect', right: 'lengthsRight', triangle: 'lengthsTriangle' } as const;
const tidy = (value: number): number => Math.round(value * 100) / 100;
/** The lengths printed on a panel, worded for its shape: "4 by 3", "legs 3 and 4" or "base 6, height 5". */
export function lengthsLabel(t: SolidsText, face: PolyFace): string {
  const [a, b] = lengthsOf(face);
  return fill(t[LENGTH_KEYS[shapeOf(face)]], { a: tidy(a), b: tidy(b) });
}

const PITCH_KEYS = { level: 'viewLevel', corner: 'viewCorner', top: 'viewTop' } as const;
export const viewLabel = (t: SolidsText, view: SolidView): string => t[PITCH_KEYS[PITCH_NAMES[view.pitch]]];

/** "Corner view. Turn 2 of 4": what a screen reader hears after every move. */
export const viewState = (t: SolidsText, view: SolidView): string => `${viewLabel(t, view)}. ${fill(t.viewTurn, { n: view.yaw + 1 })}`;

export const viewReadout = (t: SolidsText, solid: SolidId, view: SolidView): string => `${solidLabel(t, solid)}. ${viewState(t, view)}`;
