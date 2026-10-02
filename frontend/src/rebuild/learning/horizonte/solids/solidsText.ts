import type { Locale } from '../../../design/copyBudget';
import { copyText } from '../copyText';
import { SOLIDS_COPY } from './copy';
import type { SolidId } from './model.generated';
import type { FaceName } from './net.generated';
import { PITCH_NAMES, type SolidView } from './projection.generated';

export type SolidsText = { readonly [K in keyof typeof SOLIDS_COPY]: string };

export const solidsText = (locale: Locale): SolidsText => copyText(SOLIDS_COPY, locale);

/** Fills named slots such as `{solid}` or `{c}`; an unknown slot stays as written. */
export const fill = (text: string, values: Readonly<Record<string, string | number>>): string =>
  text.replace(/\{(\w+)\}/g, (slot, key: string) => (key in values ? String(values[key]) : slot));

const SOLID_KEYS = { cube: 'solidCube', prism: 'solidPrism', pyramid: 'solidPyramid', cylinder: 'solidCylinder' } as const;
export const solidLabel = (t: SolidsText, solid: SolidId): string => t[SOLID_KEYS[solid]];

const FACE_KEYS = { top: 'faceTop', bottom: 'faceBottom', front: 'faceFront', back: 'faceBack', left: 'faceLeft', right: 'faceRight' } as const;
export const faceLabel = (t: SolidsText, face: FaceName): string => t[FACE_KEYS[face]];

const PITCH_KEYS = { level: 'viewLevel', corner: 'viewCorner', top: 'viewTop' } as const;
export const viewLabel = (t: SolidsText, view: SolidView): string => t[PITCH_KEYS[PITCH_NAMES[view.pitch]]];

/** "Corner view. Turn 2 of 4": what a screen reader hears after every move. */
export const viewState = (t: SolidsText, view: SolidView): string => `${viewLabel(t, view)}. ${fill(t.viewTurn, { n: view.yaw + 1 })}`;

export const viewReadout = (t: SolidsText, solid: SolidId, view: SolidView): string => `${solidLabel(t, solid)}. ${viewState(t, view)}`;
