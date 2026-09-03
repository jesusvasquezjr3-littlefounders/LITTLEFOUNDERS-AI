#!/usr/bin/env node
/**
 * ONE WHITEBOARD INSTRUMENT, FOUR HAND-WRITTEN COPIES OF ITS SHAPE, NO
 * COMPILER BETWEEN THEM. This is the gate that notices when they disagree.
 *
 * WHY THIS EXISTS. `oracle/` and `backend/` deliberately share no types
 * (`backend/src/services/tutorData.ts` says so in its own comment, and
 * /AGENTS.md §1.5 is why). The consequence is that every whiteboard `kind`
 * is written out four times, by hand, in three services — and when a fifth
 * copy is forgotten nothing fails loudly. It has already happened twice:
 * `compare` and `marked_line` shipped without Core's `POST /turns` branch, so
 * a live board of either kind failed `safeParse` on persist and was LOST
 * SILENTLY on replay and in the guardian transcript viewer. Both were found
 * by adversarial review, months apart, and by no gate at all.
 *
 * The failure has no error message a learner or an operator ever sees: the
 * session looks perfect, the board draws, and only the recording is missing.
 * That is exactly the class /AGENTS.md §1.14 calls "failure must be
 * distinguishable from emptiness" — a replay with no board and a replay whose
 * board was dropped look identical.
 *
 * WHAT IT CHECKS, and why each one is worth a gate:
 *
 *   1. COMPLETENESS — every kind appears in every copy. This is the
 *      compare/marked_line incident, mechanised.
 *
 *   2. FIELD PARITY — the copies agree on which fields exist. A field added
 *      to Oracle's schema and forgotten in Core's body schema means Core
 *      rejects the whole turn with a 400 (the body is a discriminated union
 *      with no fallback member), not just the board.
 *
 *   3. THE MODEL MAY NOT ASSERT A DERIVED FACT. `WhiteboardCompareSchema`
 *      deliberately gives the model no `difference` and no `greater` field:
 *      the server derives both (`whiteboard.ts`'s `computeComparison`) so the
 *      model cannot claim which side is bigger. That is a SAFETY property, not
 *      a style choice, and until now nothing enforced it — a later hand could
 *      add `difference` to the model-facing schema and every test would still
 *      pass while the guarantee quietly disappeared. This gate fails if a
 *      computed field ever appears in the model-facing schema.
 *
 * WHAT IT IS NOT. It does not compare BOUNDS (Oracle's `.max(60)` vs Core's
 * `.max(60)`) — those legitimately differ by layer, since Core re-validates a
 * stored row rather than an incoming model claim, and forcing them equal would
 * be false precision. It reads SOURCE TEXT, the same way
 * `check-provider-parity.mjs` does, because the four copies live in three
 * packages that cannot import each other.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * THE MANIFEST — one entry per shipped instrument.
 *
 * `model` is what the MODEL may set. `computed` is what only the SERVER ever
 * attaches (`ws/server.ts`'s `toWireWhiteboard`). The split is the whole point:
 * `model` must never contain a `computed` field (check 3 above), and every
 * persisted/rendered copy must carry both.
 *
 * Adding a kind means adding one entry here and four blocks in the sources
 * below. If you add the entry and forget a block, this gate is what tells you.
 */
export const INSTRUMENTS = [
  {
    kind: 'sequence',
    model: ['kind', 'start', 'steps', 'unit', 'label', 'currency'],
    computed: ['values'],
    blocks: {
      oracleSchema: 'WhiteboardSequenceSchema',
      coreBody: 'SequenceWhiteboardBody',
      coreRow: 'SequenceBoardRowSchema',
    },
  },
  {
    kind: 'compare',
    model: ['kind', 'left', 'right', 'label', 'currency'],
    // Derived by `computeComparison`. The model has NO field for either —
    // see check 3 in this file's header.
    computed: ['difference', 'greater'],
    blocks: {
      oracleSchema: 'WhiteboardCompareSchema',
      coreBody: 'CompareWhiteboardBody',
      coreRow: 'CompareBoardRowSchema',
    },
  },
  {
    kind: 'marked_line',
    model: ['kind', 'min', 'max', 'marks', 'label', 'currency'],
    // `position` is computed PER MARK, inside `marks`, so it is not a
    // top-level field — see `perItemComputed` below.
    computed: [],
    perItemComputed: { field: 'marks', keys: ['position'] },
    blocks: {
      oracleSchema: 'WhiteboardMarkedLineSchema',
      coreBody: 'MarkedLineWhiteboardBody',
      coreRow: 'MarkedLineBoardRowSchema',
    },
  },
  {
    kind: 'tokens',
    model: ['kind', 'groups', 'label', 'currency'],
    // The sum of a pile is the arithmetic the learner is doing, so the model
    // gets no field for it — the same reason `compare` has no `greater`.
    computed: ['subtotals', 'total'],
    blocks: {
      oracleSchema: 'WhiteboardTokensSchema',
      coreBody: 'TokensWhiteboardBody',
      coreRow: 'TokensBoardRowSchema',
    },
  },
  {
    kind: 'bar_model',
    model: ['kind', 'whole', 'parts', 'label', 'currency'],
    // The unknown part's VALUE is never computed or sent — that is the answer.
    // Its WIDTH is, because showing how big the gap is IS the representation.
    computed: ['widths', 'unknownIndex'],
    blocks: {
      oracleSchema: 'WhiteboardBarModelSchema',
      coreBody: 'BarModelWhiteboardBody',
      coreRow: 'BarModelBoardRowSchema',
    },
  },
  {
    kind: 'part_whole',
    model: ['kind', 'whole', 'left', 'right', 'label', 'currency'],
    // Nothing derived: what the server adds is the refusal of a bond that does
    // not balance, the same posture `marked_line` has.
    computed: [],
    blocks: {
      oracleSchema: 'WhiteboardPartWholeSchema',
      coreBody: 'PartWholeWhiteboardBody',
      coreRow: 'PartWholeBoardRowSchema',
    },
  },
  {
    kind: 'flow',
    model: ['kind', 'income', 'spent', 'keptLabel', 'label', 'currency'],
    // What is LEFT is the whole lesson of `three-piles-in-out-left`, so the
    // model names the third pile but never values it.
    computed: ['kept'],
    blocks: {
      oracleSchema: 'WhiteboardFlowSchema',
      coreBody: 'FlowWhiteboardBody',
      coreRow: 'FlowBoardRowSchema',
    },
  },
  {
    kind: 'goal_bar',
    model: ['kind', 'goal', 'saved', 'label', 'currency'],
    computed: ['remaining', 'savedFraction'],
    blocks: {
      oracleSchema: 'WhiteboardGoalBarSchema',
      coreBody: 'GoalBarWhiteboardBody',
      coreRow: 'GoalBarBoardRowSchema',
    },
  },
  {
    kind: 'worked',
    model: ['kind', 'start', 'steps', 'label', 'currency'],
    computed: ['values', 'checkValue'],
    blocks: {
      oracleSchema: 'WhiteboardWorkedSchema',
      coreBody: 'WorkedWhiteboardBody',
      coreRow: 'WorkedBoardRowSchema',
    },
  },
  {
    kind: 'ten_frame',
    model: ['kind', 'count', 'label'],
    computed: ['frames'],
    blocks: {
      oracleSchema: 'WhiteboardTenFrameSchema',
      coreBody: 'TenFrameWhiteboardBody',
      coreRow: 'TenFrameBoardRowSchema',
    },
  },
  {
    kind: 'open_number_line',
    model: ['kind', 'from', 'to', 'jumps', 'label', 'currency'],
    computed: ['stops', 'positions'],
    blocks: {
      oracleSchema: 'WhiteboardOpenNumberLineSchema',
      coreBody: 'OpenNumberLineWhiteboardBody',
      coreRow: 'OpenNumberLineBoardRowSchema',
    },
  },
  {
    kind: 'array',
    model: ['kind', 'rows', 'columns', 'unitValue', 'label', 'currency'],
    computed: ['total', 'cells'],
    blocks: {
      oracleSchema: 'WhiteboardArraySchema',
      coreBody: 'ArrayWhiteboardBody',
      coreRow: 'ArrayBoardRowSchema',
    },
  },
  {
    kind: 'fraction_strip',
    model: ['kind', 'rows', 'label'],
    computed: ['shares'],
    blocks: {
      oracleSchema: 'WhiteboardFractionStripSchema',
      coreBody: 'FractionStripWhiteboardBody',
      coreRow: 'FractionStripBoardRowSchema',
    },
  },
  {
    kind: 'partition',
    model: ['kind', 'whole', 'splits', 'label', 'currency'],
    computed: ['pieceValues'],
    blocks: {
      oracleSchema: 'WhiteboardPartitionSchema',
      coreBody: 'PartitionWhiteboardBody',
      coreRow: 'PartitionBoardRowSchema',
    },
  },
  {
    kind: 'table',
    model: ['kind', 'options', 'label', 'currency'],
    computed: ['unitPrices', 'bestIndex'],
    blocks: { oracleSchema: 'WhiteboardTableSchema', coreBody: 'TableWhiteboardBody', coreRow: 'TableBoardRowSchema' },
  },
  {
    kind: 'scale',
    model: ['kind', 'left', 'right', 'label', 'currency'],
    computed: ['tilt', 'difference'],
    blocks: { oracleSchema: 'WhiteboardScaleSchema', coreBody: 'ScaleWhiteboardBody', coreRow: 'ScaleBoardRowSchema' },
  },
  {
    kind: 'two_bins',
    model: ['kind', 'binLabels', 'items', 'label'],
    computed: ['counts'],
    blocks: { oracleSchema: 'WhiteboardTwoBinsSchema', coreBody: 'TwoBinsWhiteboardBody', coreRow: 'TwoBinsBoardRowSchema' },
  },
  {
    kind: 'venn',
    model: ['kind', 'leftLabel', 'rightLabel', 'items', 'label'],
    computed: ['left', 'right', 'both'],
    blocks: { oracleSchema: 'WhiteboardVennSchema', coreBody: 'VennWhiteboardBody', coreRow: 'VennBoardRowSchema' },
  },
  {
    kind: 'ranking',
    model: ['kind', 'items', 'direction', 'label', 'currency'],
    computed: ['order'],
    blocks: { oracleSchema: 'WhiteboardRankingSchema', coreBody: 'RankingWhiteboardBody', coreRow: 'RankingBoardRowSchema' },
  },
  {
    kind: 'outcomes',
    model: ['kind', 'good', 'bad', 'label'],
    // Prose only: nothing to compute, and moderation is what guards it.
    computed: [],
    blocks: { oracleSchema: 'WhiteboardOutcomesSchema', coreBody: 'OutcomesWhiteboardBody', coreRow: 'OutcomesBoardRowSchema' },
  },
  {
    kind: 'trade',
    model: ['kind', 'left', 'right', 'label'],
    computed: [],
    blocks: { oracleSchema: 'WhiteboardTradeSchema', coreBody: 'TradeWhiteboardBody', coreRow: 'TradeBoardRowSchema' },
  },
  {
    kind: 'chance',
    model: ['kind', 'outcomes', 'label'],
    computed: ['shares'],
    blocks: { oracleSchema: 'WhiteboardChanceSchema', coreBody: 'ChanceWhiteboardBody', coreRow: 'ChanceBoardRowSchema' },
  },
  {
    kind: 'deal',
    model: ['kind', 'total', 'bins', 'label'],
    computed: ['perBin', 'remainder'],
    blocks: { oracleSchema: 'WhiteboardDealSchema', coreBody: 'DealWhiteboardBody', coreRow: 'DealBoardRowSchema' },
  },
  {
    kind: 'change',
    model: ['kind', 'price', 'paid', 'label', 'currency'],
    computed: ['change'],
    blocks: { oracleSchema: 'WhiteboardChangeSchema', coreBody: 'ChangeWhiteboardBody', coreRow: 'ChangeBoardRowSchema' },
  },
  {
    kind: 'regroup',
    model: ['kind', 'fromDenomination', 'fromCount', 'intoDenomination', 'label', 'currency'],
    computed: ['intoCount'],
    blocks: { oracleSchema: 'WhiteboardRegroupSchema', coreBody: 'RegroupWhiteboardBody', coreRow: 'RegroupBoardRowSchema' },
  },
  {
    kind: 'equation_bar',
    model: ['kind', 'left', 'right', 'label', 'currency'],
    computed: ['total'],
    blocks: { oracleSchema: 'WhiteboardEquationBarSchema', coreBody: 'EquationBarWhiteboardBody', coreRow: 'EquationBarBoardRowSchema' },
  },
  {
    kind: 'receipt',
    model: ['kind', 'lines', 'label', 'currency'],
    computed: ['total'],
    blocks: { oracleSchema: 'WhiteboardReceiptSchema', coreBody: 'ReceiptWhiteboardBody', coreRow: 'ReceiptBoardRowSchema' },
  },
  {
    kind: 'ledger',
    model: ['kind', 'entries', 'label', 'currency'],
    computed: ['balances', 'final'],
    blocks: { oracleSchema: 'WhiteboardLedgerSchema', coreBody: 'LedgerWhiteboardBody', coreRow: 'LedgerBoardRowSchema' },
  },
  {
    kind: 'price_tag',
    model: ['kind', 'item', 'price', 'units', 'discountPercent', 'label', 'currency'],
    computed: ['unitPrice', 'finalPrice'],
    blocks: { oracleSchema: 'WhiteboardPriceTagSchema', coreBody: 'PriceTagWhiteboardBody', coreRow: 'PriceTagBoardRowSchema' },
  },
  {
    kind: 'inventory',
    model: ['kind', 'item', 'start', 'sold', 'label'],
    computed: ['left'],
    blocks: { oracleSchema: 'WhiteboardInventorySchema', coreBody: 'InventoryWhiteboardBody', coreRow: 'InventoryBoardRowSchema' },
  },
  {
    kind: 'budget_plate',
    model: ['kind', 'budget', 'items', 'label', 'currency'],
    computed: ['spent', 'remaining', 'overBy'],
    blocks: { oracleSchema: 'WhiteboardBudgetPlateSchema', coreBody: 'BudgetPlateWhiteboardBody', coreRow: 'BudgetPlateBoardRowSchema' },
  },
  {
    kind: 'pictograph',
    model: ['kind', 'rows', 'unitValue', 'label', 'currency'],
    computed: ['totals'],
    blocks: { oracleSchema: 'WhiteboardPictographSchema', coreBody: 'PictographWhiteboardBody', coreRow: 'PictographBoardRowSchema' },
  },
  {
    kind: 'bead_string',
    model: ['kind', 'count', 'label'],
    computed: ['rows'],
    blocks: { oracleSchema: 'WhiteboardBeadStringSchema', coreBody: 'BeadStringWhiteboardBody', coreRow: 'BeadStringBoardRowSchema' },
  },
  {
    kind: 'tally',
    model: ['kind', 'groups', 'label'],
    computed: ['fives'],
    blocks: { oracleSchema: 'WhiteboardTallySchema', coreBody: 'TallyWhiteboardBody', coreRow: 'TallyBoardRowSchema' },
  },
  {
    kind: 'fraction_circle',
    model: ['kind', 'denominator', 'highlighted', 'label'],
    computed: ['share'],
    blocks: { oracleSchema: 'WhiteboardFractionCircleSchema', coreBody: 'FractionCircleWhiteboardBody', coreRow: 'FractionCircleBoardRowSchema' },
  },
  {
    kind: 'stack',
    model: ['kind', 'columns', 'label', 'currency'],
    computed: ['totals', 'max'],
    blocks: { oracleSchema: 'WhiteboardStackSchema', coreBody: 'StackWhiteboardBody', coreRow: 'StackBoardRowSchema' },
  },
  {
    kind: 'sequence_compare',
    model: ['kind', 'unit', 'tracks', 'label', 'currency'],
    computed: ['values'],
    blocks: { oracleSchema: 'WhiteboardSequenceCompareSchema', coreBody: 'SequenceCompareWhiteboardBody', coreRow: 'SequenceCompareBoardRowSchema' },
  },
  {
    kind: 'timeline',
    model: ['kind', 'unit', 'span', 'events', 'label'],
    computed: ['positions'],
    blocks: { oracleSchema: 'WhiteboardTimelineSchema', coreBody: 'TimelineWhiteboardBody', coreRow: 'TimelineBoardRowSchema' },
  },
  {
    kind: 'cycle',
    model: ['kind', 'steps', 'label'],
    computed: [],
    blocks: { oracleSchema: 'WhiteboardCycleSchema', coreBody: 'CycleWhiteboardBody', coreRow: 'CycleBoardRowSchema' },
  },
  {
    kind: 'before_after',
    model: ['kind', 'what', 'before', 'after', 'label', 'currency'],
    computed: ['delta', 'direction'],
    blocks: { oracleSchema: 'WhiteboardBeforeAfterSchema', coreBody: 'BeforeAfterWhiteboardBody', coreRow: 'BeforeAfterBoardRowSchema' },
  },
  {
    kind: 'grab',
    // Class II, S9 — ungraded by construction (§8.1 decision D): no field
    // for which bin an item belongs in, because the LEARNER decides that by
    // tapping, client-side, never submitted. The first kind in the catalog
    // with genuinely nothing server-computed.
    model: ['kind', 'binLabels', 'items', 'label'],
    computed: [],
    blocks: { oracleSchema: 'WhiteboardGrabSchema', coreBody: 'GrabWhiteboardBody', coreRow: 'GrabBoardRowSchema' },
  },
  {
    kind: 'fill',
    // Class II, S9 — the second interactive kind, same ungraded-by-
    // construction posture as `grab`: how many are filled is the learner's
    // own tapping, never a field the model or the server touches.
    model: ['kind', 'container', 'capacity', 'label'],
    computed: [],
    blocks: { oracleSchema: 'WhiteboardFillSchema', coreBody: 'FillWhiteboardBody', coreRow: 'FillBoardRowSchema' },
  },
  {
    kind: 'whatif',
    // Class II, S10 — NOT ungraded, unlike `grab`/`fill`: `values` is
    // server-computed, one running-value array per branch, generalizing
    // `sequence_compare`'s two simultaneous tracks (each with its own
    // `start`) into 2-3 branches that share ONE top-level `start`.
    model: ['kind', 'start', 'unit', 'branches', 'label', 'currency'],
    computed: ['values'],
    blocks: { oracleSchema: 'WhiteboardWhatifSchema', coreBody: 'WhatifWhiteboardBody', coreRow: 'WhatifBoardRowSchema' },
  },
  {
    kind: 'categories',
    model: ['kind', 'categories', 'label', 'currency'],
    computed: ['values'],
    blocks: {
      oracleSchema: 'WhiteboardCategoriesSchema',
      coreBody: 'CategoriesWhiteboardBody',
      coreRow: 'CategoriesBoardRowSchema',
    },
  },
];

const SOURCES = {
  oracleSchema: 'oracle/src/tutor/turnSchema.ts',
  wire: 'oracle/src/ws/protocol.ts',
  coreBody: 'backend/src/routes/tutor.ts',
  coreRow: 'backend/src/services/tutorData.ts',
  frontendWire: 'frontend/src/tutor/types.ts',
};

/**
 * Comments carry braces, colons and the words we scan for, so they are removed
 * before any structural scan. Block comments first, then line comments.
 *
 * Deliberately naive about `//` inside a string literal: none of the blocks
 * this file scans contains a URL, and a smarter stripper would be more code to
 * get wrong than the thing it protects. `parity-fixtures` in the test file
 * covers the shapes that actually occur here.
 */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * The text between the first `{` after `startIndex` and its matching `}`.
 * Returns null when the braces never balance.
 */
export function balancedBody(source, startIndex) {
  const open = source.indexOf('{', startIndex);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

/** The top-level keys of an object body — anything nested is skipped by depth. */
export function topLevelKeys(body) {
  const keys = [];
  let depth = 0;
  let bracket = 0;
  let paren = 0;
  let token = '';
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '[') bracket += 1;
    else if (ch === ']') bracket -= 1;
    else if (ch === '(') paren += 1;
    else if (ch === ')') paren -= 1;

    if (depth === 0 && bracket === 0 && paren === 0) {
      if (/[A-Za-z0-9_$]/.test(ch)) {
        token += ch;
        continue;
      }
      if (ch === ':' && token.length > 0) keys.push(token);
      token = '';
    } else {
      token = '';
    }
  }
  return keys;
}

/** The top-level keys of a named `const X = z.object({...})` / `z\n.object({...})` block. */
export function zodObjectKeys(source, name) {
  const clean = stripComments(source);
  const declaration = new RegExp(`\\b(?:const|export const)\\s+${name}\\b`).exec(clean);
  if (!declaration) return null;
  const objectAt = clean.indexOf('.object(', declaration.index);
  if (objectAt === -1) return null;
  const body = balancedBody(clean, objectAt);
  return body === null ? null : topLevelKeys(body);
}

/**
 * The literal value of a block's `kind` discriminant — `z.literal('compare')`
 * → `'compare'`.
 *
 * A HOLE THIS GATE SHIPPED WITH FOR ONE RUN, found by its own negative test and
 * recorded because the lesson generalises: comparing only field NAMES made the
 * gate blind to a wrong discriminant VALUE. A block named `CompareWhiteboardBody`
 * that declares `kind: z.literal('compare_TYPO')` has exactly the right field
 * names and is, in production, unreachable — Core's discriminated union would
 * reject every real `compare` board and 400 the whole turn. Six of seven
 * negative tests went red without this; the seventh is why it exists.
 */
export function zodDiscriminant(source, name) {
  const clean = stripComments(source);
  const declaration = new RegExp(`\\b(?:const|export const)\\s+${name}\\b`).exec(clean);
  if (!declaration) return null;
  const body = balancedBody(clean, clean.indexOf('.object(', declaration.index));
  if (body === null) return null;
  const literal = /kind\s*:\s*z\s*\.\s*literal\(\s*'([^']+)'\s*\)/.exec(body);
  return literal ? literal[1] : null;
}

/**
 * The keys of one nested item shape — `field: z.array(z.object({…}))` written
 * inline, OR `field: z.array(SomeNamedSchema)` written by reference.
 *
 * FALSE POSITIVE THIS FUNCTION ALREADY PRODUCED, recorded so nobody re-derives
 * it: the first version only looked for an inline `.object(` after `field:`,
 * and on `marks: z.array(WhiteboardMarkRowSchema)` it happily found the NEXT
 * unrelated `.object(` in the file (`WhiteboardCategoryRowSchema`) and reported
 * that `marked_line` was missing its server-computed `position`. Core was
 * correct; the instrument was wrong. That is the same class /AGENTS.md §1.14
 * warns about under "a harness that cannot operate a surface reports the product
 * as broken" — and a parity gate that cries wolf is worse than none, because the
 * next real failure gets waved through.
 */
export function zodNestedKeys(source, name, field) {
  const clean = stripComments(source);
  const declaration = new RegExp(`\\b(?:const|export const)\\s+${name}\\b`).exec(clean);
  if (!declaration) return null;
  const body = balancedBody(clean, clean.indexOf('.object(', declaration.index));
  if (body === null) return null;

  // The field's own value expression, bounded by the block it lives in so a
  // miss can never wander into the next declaration.
  const fieldAt = body.indexOf(`${field}:`);
  if (fieldAt === -1) return null;
  const expression = body.slice(fieldAt);

  if (/z\s*\.\s*array\(\s*z\s*\.\s*object\(|^\s*[A-Za-z_$]*\s*:\s*z\s*\.\s*object\(/.test(expression)) {
    const inline = balancedBody(expression, expression.indexOf('.object('));
    return inline === null ? null : topLevelKeys(inline);
  }

  // By reference: resolve the named schema in the same file.
  const referenced = /z\s*\.\s*array\(\s*([A-Za-z_$][\w$]*)\s*\)/.exec(expression);
  if (!referenced) return null;
  return zodObjectKeys(source, referenced[1]);
}

/**
 * The member of a TypeScript discriminated union whose `kind` is `kind`.
 *
 * Used for the two copies that are TYPES rather than schemas —
 * `frontend/src/tutor/types.ts`'s `TutorWhiteboardWire`, and (for the
 * server-computed half only) `oracle/src/ws/protocol.ts`'s `WireWhiteboard`.
 */
export function unionMemberKeys(source, typeName, kind) {
  const clean = stripComments(source);
  const declaration = new RegExp(`\\btype\\s+${typeName}\\s*=`).exec(clean);
  if (!declaration) return null;
  let cursor = declaration.index;
  // Walk each `{ … }` group after the declaration until one declares this kind.
  // Stops at the first blank-line-separated top-level statement after the type.
  const end = clean.indexOf('\nexport ', declaration.index + 1);
  const region = clean.slice(declaration.index, end === -1 ? undefined : end);
  let offset = 0;
  for (;;) {
    const body = balancedBody(region, offset);
    if (body === null) return null;
    const open = region.indexOf('{', offset);
    const keys = topLevelKeys(body);
    if (new RegExp(`kind\\s*:\\s*'${kind}'`).test(body)) return keys;
    offset = open + body.length + 2;
    if (offset >= region.length) return null;
  }
}

/**
 * `two_bins` → `WhiteboardTwoBins`, `before_after` → `WhiteboardBeforeAfter`:
 * the mechanical transform every `kind` string's own TS type name follows,
 * used by `wireComputedKeys` below. USED TO BE A 40-ENTRY HAND-WRITTEN MAP,
 * which is exactly the class of copy this whole gate exists to catch — and
 * did catch, on itself: adding `grab` (Class II, S9) to `INSTRUMENTS` below
 * failed with "no WireWhiteboard member found" even though the real
 * `WireWhiteboard` union in protocol.ts already carried `WhiteboardGrab`,
 * because this map had no `grab` entry and nothing forced one to be added.
 * Every existing kind's name already followed this exact transform with no
 * exception, so the map was never earning its keep — it was a SEVENTH place
 * to remember, on top of the five real copies and the manifest itself.
 */
export function kindTypeName(kind) {
  return 'Whiteboard' + kind.split('_').map((s) => s[0].toUpperCase() + s.slice(1)).join('');
}

/**
 * The server-computed fields `protocol.ts` attaches for a kind. That file
 * builds each member as `WhiteboardX & { …computed… }`, so the model half is
 * inherited (it cannot drift) and only this half is hand-written.
 */
export function wireComputedKeys(source, kind) {
  const clean = stripComments(source);
  const declaration = /\btype\s+WireWhiteboard\s*=/.exec(clean);
  if (!declaration) return null;
  const end = clean.indexOf('\nexport ', declaration.index + 1);
  const region = clean.slice(declaration.index, end === -1 ? undefined : end);
  const kindType = kindTypeName(kind);
  // Two legal forms, and the difference between them is meaningful: a kind with
  // server-computed fields is written `(WhiteboardX & { … })`, and a kind with
  // NONE is written bare as `| WhiteboardX`. Only the first has keys to read;
  // the second must still be PRESENT, or the wire cannot carry that kind at all.
  const intersected = new RegExp(`\\(${kindType}\\s*&`).exec(region);
  if (intersected) {
    const body = balancedBody(region, intersected.index);
    return body === null ? null : topLevelKeys(body);
  }
  const bare = new RegExp(`\\|\\s*${kindType}\\s*(?:;|$)`, 'm').exec(region);
  return bare ? [] : null;
}

const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x)) && b.every((x) => a.includes(x));

export function checkInstrumentParity(read) {
  const problems = [];
  const src = Object.fromEntries(Object.entries(SOURCES).map(([id, file]) => [id, read(file)]));

  for (const instrument of INSTRUMENTS) {
    const { kind, model, computed, blocks } = instrument;
    const expectedFull = [...model, ...computed];
    const where = (id) => `${SOURCES[id]} (${kind})`;

    // 1 — the model-facing schema carries EXACTLY the model fields.
    const oracleKeys = zodObjectKeys(src.oracleSchema, blocks.oracleSchema);
    if (oracleKeys === null) {
      problems.push(`${where('oracleSchema')}: ${blocks.oracleSchema} not found`);
    } else {
      const leaked = computed.filter((f) => oracleKeys.includes(f));
      if (leaked.length > 0) {
        problems.push(
          `${where('oracleSchema')}: ${leaked.join(', ')} is SERVER-COMPUTED and must not be a field ` +
            'the model can set — the server derives it so the model cannot assert it',
        );
      }
      if (!same(oracleKeys, model)) {
        problems.push(`${where('oracleSchema')}: fields ${oracleKeys.join(',')} ≠ manifest ${model.join(',')}`);
      }
      const discriminant = zodDiscriminant(src.oracleSchema, blocks.oracleSchema);
      if (discriminant !== kind) {
        problems.push(
          `${where('oracleSchema')}: ${blocks.oracleSchema} declares kind '${discriminant}', not '${kind}'`,
        );
      }
    }

    // 2 — the wire declares every computed field.
    const wireComputed = wireComputedKeys(src.wire, kind);
    if (wireComputed === null) {
      problems.push(`${where('wire')}: no WireWhiteboard member found`);
    } else if (computed.length > 0 && !same(wireComputed, computed)) {
      problems.push(`${where('wire')}: computed ${wireComputed.join(',')} ≠ manifest ${computed.join(',')}`);
    }

    // 3 + 4 — both Core copies carry model AND computed, under the right
    // discriminant. The VALUE matters as much as the fields: a block with the
    // right shape and the wrong `kind` literal is unreachable in a
    // discriminated union, and Core rejects the whole turn rather than the board.
    for (const id of ['coreBody', 'coreRow']) {
      const keys = zodObjectKeys(src[id], blocks[id]);
      if (keys === null) {
        problems.push(`${where(id)}: ${blocks[id]} not found — a kind Core cannot parse loses the whole turn`);
        continue;
      }
      const discriminant = zodDiscriminant(src[id], blocks[id]);
      if (discriminant !== kind) {
        problems.push(
          `${where(id)}: ${blocks[id]} declares kind '${discriminant}', not '${kind}' — ` +
            'a member no discriminated union can ever reach',
        );
      }
      if (!same(keys, expectedFull)) {
        problems.push(`${where(id)}: fields ${keys.join(',')} ≠ manifest ${expectedFull.join(',')}`);
      }
    }

    // 5 — the frontend mirror carries model AND computed.
    const feKeys = unionMemberKeys(src.frontendWire, 'TutorWhiteboardWire', kind);
    if (feKeys === null) {
      problems.push(`${where('frontendWire')}: no TutorWhiteboardWire member — the client cannot draw this kind`);
    } else if (!same(feKeys, expectedFull)) {
      problems.push(`${where('frontendWire')}: fields ${feKeys.join(',')} ≠ manifest ${expectedFull.join(',')}`);
    }

    // 6 — per-item computed fields (marked_line's `position`).
    if (instrument.perItemComputed) {
      const { field, keys: needed } = instrument.perItemComputed;
      for (const id of ['coreBody', 'coreRow']) {
        const nested = zodNestedKeys(src[id], blocks[id], field);
        if (nested === null) {
          problems.push(`${where(id)}: ${blocks[id]}.${field} not found`);
        } else {
          const missing = needed.filter((k) => !nested.includes(k));
          if (missing.length > 0) {
            problems.push(`${where(id)}: ${blocks[id]}.${field} is missing computed ${missing.join(',')}`);
          }
        }
      }
      const oracleNested = zodNestedKeys(src.oracleSchema, blocks.oracleSchema, field);
      // The model-facing item schema is a separate named schema, so a null
      // here is expected; what matters is that if it IS inline, it stays clean.
      if (oracleNested !== null) {
        const leaked = needed.filter((k) => oracleNested.includes(k));
        if (leaked.length > 0) {
          problems.push(`${where('oracleSchema')}: ${field}.${leaked.join(',')} is server-computed`);
        }
      }
    }
  }

  return problems;
}

function main() {
  const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
  const problems = checkInstrumentParity(read);
  if (problems.length > 0) {
    console.error('instruments:check FAILED — the copies of a whiteboard instrument disagree:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error(
      '\nEvery kind is written out by hand in oracle/turnSchema.ts, oracle/ws/protocol.ts,\n' +
        'backend/routes/tutor.ts, backend/services/tutorData.ts and frontend/tutor/types.ts.\n' +
        'A missing copy does not throw: it loses the board silently on replay (Core rejects\n' +
        'the persist) or 400s the whole turn (the body union has no fallback member).\n' +
        'Deploy order for a NEW kind is Core BEFORE Oracle.',
    );
    process.exitCode = 1;
    return;
  }
  const kinds = INSTRUMENTS.map((i) => i.kind).join(', ');
  console.log(`instruments:check OK — ${INSTRUMENTS.length} instruments agree across all copies (${kinds})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
