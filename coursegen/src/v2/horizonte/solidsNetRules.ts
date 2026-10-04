import type { SolvabilityCode } from '../solvability.js';
import {
  attach, buildNet, buildSolid, completionsOf, edgeBetween, faceIndex, fitsSheet, isPolyFaceName, layoutExtent, netOverlaps, polyCompleteFixed,
  polyLabelSolutions, POLY_LABEL_FIXED, POLY_LIMITS, readSolidSpec, SHEET_LIMITS, slotsToHinges, slotsToPanelNames, surfaceAreaOf, unfold,
  type Hinge, type PolyFaceName, type PolySolid, type PolySolidSpec, type Sheet,
} from './solidsPolynet.js';

/*
 * The Forge side of F4.2 for the solids that are not cubes (`geometry.solid-net.v2`). It mirrors the authoring rules of Core
 * (`backend/src/services/horizonte/solids/rules.ts`) but reports a reason instead of a bare null, so an author can fix a piece.
 * The geometry itself is the pinned copy in solidsPolynet.ts.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

export interface SolidLabel { mode: 'label'; solid: PolySolidSpec; net: string; fixed: Array<{ panel: number; name: PolyFaceName }> }
export interface SolidComplete { mode: 'complete'; solid: PolySolidSpec; root: PolyFaceName; fixed: Array<{ parent: PolyFaceName; child: PolyFaceName }>; sheet: Sheet }
export interface SolidArea { mode: 'area'; solid: PolySolidSpec; net: string }
export type SolidNetPayload = SolidLabel | SolidComplete | SolidArea;

/** How far a sheet side must stay from the extent of any net, in the lengths of the solid: the fit test is float arithmetic and must never be a tie. */
export const SHEET_MARGIN = 0.3;

export function readSolidNet(value: unknown): SolidNetPayload | string {
  if (!isRecord(value)) return 'the solid net payload is an object with a mode';
  const spec = readSolidSpec(value.solid);
  if (!spec) return 'solid is { kind, dims }: rect-prism [length, width, height], tri-prism [leg, leg, length] with a whole hypotenuse, or sq-pyramid [base, slant height] with the slant above half the base, all whole lengths up to 20 (slant up to 30)';
  const faces = buildSolid(spec)?.faces.length ?? 0;
  if (value.mode === 'label') {
    if (!exactKeys(value, ['mode', 'solid', 'net', 'fixed']) || typeof value.net !== 'string' || !Array.isArray(value.fixed)) return 'a label net is exactly mode, solid, net (a catalogue id) and fixed';
    if (value.fixed.length < POLY_LABEL_FIXED.min || value.fixed.length > POLY_LABEL_FIXED.max) return `a label net gives ${POLY_LABEL_FIXED.min} to ${POLY_LABEL_FIXED.max} named panels in fixed`;
    const fixed: SolidLabel['fixed'] = [];
    for (const entry of value.fixed) {
      if (!isRecord(entry) || !exactKeys(entry, ['panel', 'name']) || !whole(entry.panel, 0, faces - 1) || !isPolyFaceName(entry.name)) return `each fixed entry is { panel: 0 to ${faces - 1}, name: a face name }`;
      fixed.push({ panel: entry.panel, name: entry.name });
    }
    return { mode: 'label', solid: spec, net: value.net, fixed };
  }
  if (value.mode === 'complete') {
    if (!exactKeys(value, ['mode', 'solid', 'root', 'fixed', 'sheet']) || !isPolyFaceName(value.root) || !Array.isArray(value.fixed)) return 'a complete net is exactly mode, solid, root (a face name), fixed (hinges) and sheet';
    const range = polyCompleteFixed(spec.kind);
    if (value.fixed.length < range.min || value.fixed.length > range.max) return `a complete net on this solid gives ${range.min} to ${range.max} hinges in fixed`;
    const sheet = value.sheet;
    if (!isRecord(sheet) || !exactKeys(sheet, ['width', 'height']) || !whole(sheet.width, SHEET_LIMITS.min, SHEET_LIMITS.max) || !whole(sheet.height, SHEET_LIMITS.min, SHEET_LIMITS.max)) {
      return `sheet is { width, height }, whole lengths from ${SHEET_LIMITS.min} to ${SHEET_LIMITS.max}`;
    }
    const fixed: SolidComplete['fixed'] = [];
    for (const entry of value.fixed) {
      if (!isRecord(entry) || !exactKeys(entry, ['parent', 'child']) || !isPolyFaceName(entry.parent) || !isPolyFaceName(entry.child)) return 'each fixed hinge is { parent, child }, both face names';
      fixed.push({ parent: entry.parent, child: entry.child });
    }
    return { mode: 'complete', solid: spec, root: value.root, fixed, sheet: { width: sheet.width, height: sheet.height } };
  }
  if (value.mode === 'area') {
    if (!exactKeys(value, ['mode', 'solid', 'net']) || typeof value.net !== 'string') return 'an area net is exactly mode, solid and net (a catalogue id)';
    return { mode: 'area', solid: spec, net: value.net };
  }
  return 'the net mode is label, complete or area';
}

/** The hinges a complete payload gives as indices into the solid's faces; null when one joins two faces that share no edge or the root is not a face. */
export function givenHinges(payload: SolidComplete, solid: PolySolid): { root: number; hinges: Hinge[] } | null {
  const root = faceIndex(solid, payload.root);
  const hinges = payload.fixed.map((entry) => ({ parent: faceIndex(solid, entry.parent), child: faceIndex(solid, entry.child) }));
  if (root < 0 || hinges.some((hinge) => hinge.parent < 0 || hinge.child < 0 || !edgeBetween(solid, hinge.parent, hinge.child))) return null;
  return { root, hinges };
}

/** A reason a payload cannot be asked, as a solvability code and a sentence (without the segment it belongs to). */
export interface NetFinding { code: SolvabilityCode; message: string }
const found = (code: SolvabilityCode, message: string): NetFinding[] => [{ code, message }];

/** The whole number of square units the surface of the solid has; null when it is not a whole number or is above what an answer can hold. */
export function solidArea(solid: PolySolid): number | null {
  const area = surfaceAreaOf(solid);
  return Number.isInteger(area) && area >= 1 && area <= POLY_LIMITS.areaMaximum ? area : null;
}

/** Every labelling of the panels of the named net that keeps the given names, as comma joined names; null when the net does not exist for the solid. */
export function labelAnswers(payload: SolidLabel, solid: PolySolid): string[] | null {
  const net = buildNet(solid, payload.net);
  if (!net) return null;
  return polyLabelSolutions(net, Object.fromEntries(payload.fixed.map((entry) => [entry.panel, entry.name]))).map((labelling) => labelling.join());
}

function labelFindings(payload: SolidLabel, solid: PolySolid): NetFinding[] {
  const net = buildNet(solid, payload.net);
  if (!net) return found('impossible-state', `this solid has no net called ${payload.net}`);
  if (netOverlaps(net)) return found('overlap', 'the net overlaps itself');
  if (new Set(payload.fixed.map((entry) => entry.panel)).size !== payload.fixed.length) return found('duplicate-id', 'a panel is named once');
  if (new Set(payload.fixed.map((entry) => entry.name)).size !== payload.fixed.length) return found('duplicate-id', 'a face name is given once');
  const answers = labelAnswers(payload, solid)!;
  if (answers.length === 0) return found('no-solution', 'the given names cannot belong to one folding of this net, so the learner cannot succeed');
  if (answers.length > 1) return found('ambiguous-solution', `the given names leave ${answers.length} ways to name the rest; name one more panel so exactly one fits`);
  return [];
}

function tightSheet(payload: SolidComplete, solid: PolySolid, root: number, hinges: Hinge[]): boolean {
  const nets = completionsOf(solid, root, hinges, null, 256).sets;
  return nets.some((tree) => {
    const extent = layoutExtent(unfold(solid, root, tree)!);
    return Math.abs(extent.width - payload.sheet.width) < SHEET_MARGIN || Math.abs(extent.height - payload.sheet.height) < SHEET_MARGIN;
  });
}

function completeFindings(payload: SolidComplete, solid: PolySolid): NetFinding[] {
  const given = givenHinges(payload, solid);
  if (!given) return found('impossible-state', 'a given hinge must join two faces that share an edge, and the root must be a face of the solid');
  if (new Set(given.hinges.map((hinge) => hinge.child)).size !== given.hinges.length) return found('duplicate-id', 'a face hangs from one hinge only');
  if (attach(given.root, given.hinges).orphans.length > 0) return found('impossible-state', 'every given hinge must hang from the root face');
  const onSheet = completionsOf(solid, given.root, given.hinges, payload.sheet, 0).count;
  if (onSheet === 0) return found('no-solution', 'the given hinges cannot be completed into a net that fits the sheet, so the learner cannot succeed');
  if (completionsOf(solid, given.root, given.hinges, null, 0).count <= onSheet) return found('vacuous-rubric', 'the sheet rules out no net, so every completion is right; make the sheet smaller');
  if (tightSheet(payload, solid, given.root, given.hinges)) return found('out-of-bounds', `a net is within ${SHEET_MARGIN} of the sheet size, so whether it fits is a tie; change the sheet by at least one unit`);
  return [];
}

function areaFindings(payload: SolidArea, solid: PolySolid): NetFinding[] {
  const net = buildNet(solid, payload.net);
  if (!net) return found('impossible-state', `this solid has no net called ${payload.net}`);
  if (netOverlaps(net)) return found('overlap', 'the net overlaps itself');
  return solidArea(solid) === null ? found('too-large', `the surface area must be a whole number from 1 to ${POLY_LIMITS.areaMaximum}`) : [];
}

/** What is wrong with the question itself, with no answer key in sight. An empty list means the learner can succeed and, in label mode, in one way only. */
export function solidNetFindings(payload: SolidNetPayload): NetFinding[] {
  const solid = buildSolid(payload.solid);
  if (!solid) return found('impossible-state', 'the solid is not one this piece can build');
  if (payload.mode === 'label') return labelFindings(payload, solid);
  if (payload.mode === 'complete') return completeFindings(payload, solid);
  return areaFindings(payload, solid);
}

/** One label solution of a key as comma joined names: all panels named, one name each, nothing else; null otherwise. */
export function keyLabelling(slots: Record<string, string[]>, panels: number): string | null {
  const names = slotsToPanelNames(slots, panels);
  return names !== null && Object.keys(slots).length === panels ? names.join() : null;
}

/** True when one complete-mode key solution hangs every face from the given hinges into a net that fits the sheet. */
export function keyCompletes(payload: SolidComplete, solid: PolySolid, slots: Record<string, string[]>): boolean {
  const given = givenHinges(payload, solid);
  if (!given) return false;
  const wanted = slotsToHinges(solid, slots);
  if (wanted === null || wanted.length !== solid.faces.length - 1) return false;
  if (!given.hinges.every((hinge) => wanted.some((entry) => entry.parent === hinge.parent && entry.child === hinge.child))) return false;
  const attached = attach(given.root, wanted);
  if (attached.orphans.length > 0) return false;
  const layout = unfold(solid, given.root, attached.ordered);
  return layout !== null && layout.overlaps.length === 0 && fitsSheet(layout, payload.sheet);
}
