import { z } from 'zod';
import { mathNotation } from '../../v2SegmentFamilies.js';
import { hzBase, hzId, hzServer, hzVisual } from '../shared.js';
import type { HorizonteAgeScope } from '../types.js';
import { MAX_SOLUTIONS, SLOT_CAPACITY } from './arrange.js';
import { areaTex, readArea, AREA_MAX_COEFFICIENT, SQUARE_BOUNDS } from './area.js';
import { equationTex, readCards, CARD_MAX_SIDE, CARD_MAX_SUPPLY, DISGUISES } from './cards.js';
import { readTileCounts, tileTex, TILE_MAX_PER_CLASS } from './tiles.js';

/** The problem in TeX, with the spoken form in the lesson's own language as its accessible name (Bible 05 section 5). */
export const algebraNotation = z.object({ tex: mathNotation, spokenText: z.string().trim().min(1).max(160) }).strict();
const compact = (tex: string): string => tex.replace(/\s+/g, '');

const tileCount = z.number().int().min(0).max(TILE_MAX_PER_CLASS);
/** F2.1 / D02 / B27: the tiles to simplify; the payload carries the tiles, never the zero pairs. */
export const algebraTilesPayload = z.object({
  counts: z.object({ 'sq-pos': tileCount, 'sq-neg': tileCount, 'bar-pos': tileCount, 'bar-neg': tileCount, 'unit-pos': tileCount, 'unit-neg': tileCount }).strict(),
}).strict();

const face = z.string().regex(/^(unk|unk-neg|(pos|neg)-[1-9])$/);
/** F2.2 / D06: the equation as cards, plus the supply cards that go onto both sides. */
export const algebraCardsPayload = z.object({
  disguise: z.enum(DISGUISES),
  left: z.array(face).min(1).max(CARD_MAX_SIDE),
  right: z.array(face).min(1).max(CARD_MAX_SIDE),
  supply: z.array(face).max(CARD_MAX_SUPPLY),
}).strict();

const term = z.string().regex(/^[0-2]:-?[1-9][0-9]?$/);
const pool = (minimum: number, maximum: number) => z.array(term).min(minimum).max(maximum);
/** F2.3 / D09 / D10 / D11: one area model; `fill` says what the learner places. */
export const areaModelPayload = z.discriminatedUnion('fill', [
  z.object({ fill: z.literal('cells'), rows: z.array(term).min(1).max(2), cols: z.array(term).min(2).max(3), pool: pool(2, 10) }).strict(),
  z.object({ fill: z.literal('edges'), cells: z.array(term).length(4), pool: pool(4, 10) }).strict(),
  z.object({ fill: z.literal('square'), b: z.number().int().min(SQUARE_BOUNDS.minB).max(SQUARE_BOUNDS.maxB), c: z.number().int().min(-SQUARE_BOUNDS.maxC).max(SQUARE_BOUNDS.maxC), pool: pool(2, 8) }).strict(),
]);

const issue = (ctx: z.RefinementCtx, path: Array<string | number>, message: string): void => ctx.addIssue({ code: 'custom', path, message });

export const ALG1_SEGMENTS = [
  z.object({
    ...hzBase, type: z.literal('math.algebra-tiles.v2'), grading: hzServer,
    visual: z.union([hzVisual('algebra-tiles'), hzVisual('signed-tiles')]), notation: algebraNotation, payload: algebraTilesPayload,
  }).strict().superRefine((value, ctx) => {
    const counts = readTileCounts(value.payload.counts);
    if (!counts) return issue(ctx, ['payload', 'counts'], 'The tiles are 1 to 24 and hold at least one zero pair');
    const unitsOnly = counts['sq-pos'] + counts['sq-neg'] + counts['bar-pos'] + counts['bar-neg'] === 0;
    if ((value.visual.type === 'signed-tiles') !== unitsOnly) issue(ctx, ['visual'], 'Signed tiles are 1 tiles only, and 1 tiles only are signed tiles');
    if (compact(value.notation.tex) !== tileTex(counts)) issue(ctx, ['notation', 'tex'], 'The notation is the tiles written as an expression');
  }),
  z.object({
    ...hzBase, type: z.literal('math.algebra-cards.v2'), grading: hzServer,
    visual: hzVisual('algebra-cards'), notation: algebraNotation.optional(), payload: algebraCardsPayload,
  }).strict().superRefine((value, ctx) => {
    const cards = readCards(value.payload);
    if (!cards) return issue(ctx, ['payload'], 'The cards need one to eight reachable isolations of the unknown, none of them the start');
    if (value.payload.disguise !== 'picture' && !value.notation) issue(ctx, ['notation'], 'Only the picture disguise may leave the notation out');
    if (value.notation && compact(value.notation.tex) !== equationTex(cards)) issue(ctx, ['notation', 'tex'], 'The notation is the equation the cards make');
  }),
  z.object({
    ...hzBase, type: z.literal('math.area-model.v2'), grading: hzServer,
    visual: z.union([hzVisual('area-distribute'), hzVisual('area-binomial'), hzVisual('area-square')]), notation: algebraNotation, payload: areaModelPayload,
  }).strict().superRefine((value, ctx) => {
    const area = readArea(value.payload);
    if (!area) return issue(ctx, ['payload'], `The area model needs one to ${MAX_SOLUTIONS} right answers and coefficients up to ${AREA_MAX_COEFFICIENT}`);
    const visual = value.visual.type;
    const matches = visual === 'area-square' ? area.fill === 'square'
      : visual === 'area-distribute' ? area.fill === 'cells' && area.rows.length === 1
        : (area.fill === 'cells' && area.rows.length === 2) || area.fill === 'edges';
    if (!matches) issue(ctx, ['visual'], 'The visual matches the fill and the shape');
    if (compact(value.notation.tex) !== areaTex(area)) issue(ctx, ['notation', 'tex'], 'The notation is the problem the area model shows');
  }),
] as const;

/** F0.3 arrangement.slots: a key is one to eight slot maps of class ids, since pieces of a class are interchangeable. */
const arrangementRubric = z.object({
  solutions: z.array(z.record(hzId, z.array(hzId).max(SLOT_CAPACITY))).min(1).max(MAX_SOLUTIONS),
  ordered: z.literal(false).optional(),
}).strict();

export const ALG1_RUBRICS = {
  'math.algebra-tiles.v2': arrangementRubric,
  'math.algebra-cards.v2': arrangementRubric,
  'math.area-model.v2': arrangementRubric,
} as const;

export const ALG1_AGE_SCOPE: Readonly<Record<string, HorizonteAgeScope>> = {
  'math.algebra-tiles.v2': { ages: [11, 15], adult: false },
  'math.algebra-cards.v2': { ages: [10, 14], adult: false },
  'math.area-model.v2': { ages: [13, 17], adult: false },
};
