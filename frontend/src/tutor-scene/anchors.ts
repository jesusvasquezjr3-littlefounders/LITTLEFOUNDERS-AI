/*
 * The closed vocabulary of NAMED PLACES on the Tutor's stage.
 *
 * Every in-scene control that carries text is a DOM node positioned over the
 * canvas, and it has to know WHERE. Handing those components a coordinate would
 * have two costs, and the second one is the expensive one: a component holding
 * `[1.4, 1.9, -0.2]` is a component that must be rewritten when an island
 * changes size, and — because a coordinate in this system is a `Vector3` — it is
 * also a component that imports `three`. That would drag the whole renderer into
 * the product layer and out of the lazy route it is deliberately confined to
 * (frontend/AGENTS.md: `three` must only ever be reached through a lazy route).
 *
 * So a DOM component asks for `'lead.head'`. The scene publishes what that means
 * this frame, on this island, for this cast. The two halves never share a type
 * heavier than a string.
 *
 * This module imports NOTHING on purpose — not `three`, not React. It is the one
 * piece of the anchor system both sides of the canvas boundary can hold.
 */

/**
 * Every place a HUD node may be anchored to.
 *
 * Deliberately CLOSED and deliberately small. A union is what makes an unknown
 * slot a type error at the call site rather than a node that silently never
 * moves — which is the failure mode of a string-keyed registry, and an
 * invisible one, since an unpositioned node still renders at 0,0.
 *
 *   lead / companion  — the cast. CROWN for anything that must sit ABOVE the
 *                       character, head for anything centred on them, chest for
 *                       anything they are offering or holding.
 *
 *                       Crown and head are two places rather than one offset,
 *                       and the reason is that a CSS offset cannot know how big
 *                       the character is on screen. `lead.head` is the MID-head,
 *                       chosen so the camera can aim at it; at a close-up that
 *                       point is roughly 290 CSS px below the crown on a 1280
 *                       viewport and roughly 40 px below it at the establishing
 *                       shot. A caption nudged upward by a fixed number of
 *                       pixels therefore lands on the forehead in exactly the
 *                       shot a conversation spends most of its time in. Publish
 *                       the crown from the scene, where the character's height
 *                       is known in metres, and the same 8 px gap is correct at
 *                       every distance by construction.
 *   island.*          — fixed places on the scenery, for chrome that belongs to
 *                       the PLACE rather than to a person: recap chips, session
 *                       stones, the rim pads a personalization tap lands on.
 *   stage.mark.N      — five free marks at standing height around the island,
 *                       for choices that need to be laid out rather than
 *                       attached to something (offers, adaptation chips).
 *   sky.mark.N        — five free marks above the island, for status runes that
 *                       must never overlap the cast.
 *
 * The five-mark budget is a composition decision, not an arbitrary cap: the
 * closed set of openings the tutor can offer is at most five (/ORACLE.md), and
 * a sixth simultaneous floating control would be a layout problem no anchor
 * position can solve.
 */
export type AnchorId =
  | 'lead.crown'
  | 'lead.head'
  | 'lead.chest'
  | 'companion.crown'
  | 'companion.head'
  | 'island.rim.left'
  | 'island.rim.right'
  | 'island.centre'
  | 'stage.mark.0'
  | 'stage.mark.1'
  | 'stage.mark.2'
  | 'stage.mark.3'
  | 'stage.mark.4'
  | 'sky.mark.0'
  | 'sky.mark.1'
  | 'sky.mark.2'
  | 'sky.mark.3'
  | 'sky.mark.4';

/** How many free marks exist on each ring. Both rings carry the same count. */
export const ANCHOR_MARK_COUNT = 5;

/**
 * The runtime mirror of the union.
 *
 * Written out rather than generated from a loop so that TypeScript can check it
 * against the union: the `satisfies` below fails to compile if a member is
 * missing or misspelled, which is the only way a list like this stays true. A
 * generated `stage.mark.${i}` would type as `string` and check nothing.
 */
export const ANCHOR_IDS = [
  'lead.crown',
  'lead.head',
  'lead.chest',
  'companion.crown',
  'companion.head',
  'island.rim.left',
  'island.rim.right',
  'island.centre',
  'stage.mark.0',
  'stage.mark.1',
  'stage.mark.2',
  'stage.mark.3',
  'stage.mark.4',
  'sky.mark.0',
  'sky.mark.1',
  'sky.mark.2',
  'sky.mark.3',
  'sky.mark.4',
] as const satisfies readonly AnchorId[];

/*
 * Exhaustiveness in the other direction.
 *
 * `satisfies readonly AnchorId[]` proves every entry IS an AnchorId. It says
 * nothing about the reverse, and the reverse is the one that ships a bug: a
 * slot added to the union but not to the array is a name the product can ask
 * for and nothing will ever position.
 *
 * The obvious guard for this does NOT work, and did not:
 *
 *   const _every: Record<AnchorId, true> =
 *     Object.fromEntries(ANCHOR_IDS.map((id) => [id, true])) as Record<AnchorId, true>;
 *
 * `Object.fromEntries` is typed `{ [k: string]: T }`, so the assertion — not
 * the compiler — is what produces the `Record<AnchorId, true>`, and the
 * annotation then checks an assertion against itself. Proven inert by adding
 * `| 'lead.hands'` to the union and leaving the array alone: `tsc --noEmit`
 * exited 0. The unit tests could not catch it either, because every one of
 * them iterates ANCHOR_IDS and so only ever sees what is already there.
 *
 * This version has no runtime value to assert about. `Exclude` is computed by
 * the compiler from the two things being compared, so there is nothing for a
 * cast to paper over: any member of the union missing from the array makes
 * `MissingAnchors` non-`never` and the assignment below fails to compile.
 */
type MissingAnchors = Exclude<AnchorId, (typeof ANCHOR_IDS)[number]>;
type AssertNever<T extends never> = T;
export type _EveryAnchorIsListed = AssertNever<MissingAnchors>;

/** The free marks at standing height, in ring order. */
export const STAGE_MARK_IDS = [
  'stage.mark.0',
  'stage.mark.1',
  'stage.mark.2',
  'stage.mark.3',
  'stage.mark.4',
] as const satisfies readonly AnchorId[];

/** The free marks above the island, in ring order. */
export const SKY_MARK_IDS = [
  'sky.mark.0',
  'sky.mark.1',
  'sky.mark.2',
  'sky.mark.3',
  'sky.mark.4',
] as const satisfies readonly AnchorId[];

/**
 * Which marks the personalization candidates take, in candidate order.
 *
 * IT LIVES HERE BECAUSE BOTH SIDES OF THE CANVAS NEED THE SAME ANSWER. The HUD
 * hangs candidate `i`'s name plate on `castMarks(n)[i]`; the scene republishes
 * that same mark at candidate `i`'s crown, so the plate labels the person
 * standing under it. Two copies of this table would drift the first time
 * somebody added a fifth character, and the failure would be a name floating
 * over the wrong face — which reads as a rendering glitch rather than as two
 * lists disagreeing. `anchors.ts` imports nothing, so it is the one module both
 * halves can hold.
 *
 * The middle of the arc is given up first, because that is where the placement
 * solver puts a solo cast: a spare mark parked across the tutor's face is a
 * worse composition than a ring with a gap in it.
 */
export function castMarks(count: number): readonly AnchorId[] {
  const marks: AnchorId[] = [...STAGE_MARK_IDS];
  while (marks.length > count && marks.length > 1) {
    marks.splice(Math.floor(marks.length / 2), 1);
  }
  return marks.slice(0, count);
}

/**
 * Narrows an arbitrary string to an `AnchorId`.
 *
 * Exists for the scene lab's debug overlay, which iterates ids read back out of
 * the DOM. Product code should never need it: a literal that does not narrow is
 * a mistake the compiler already caught.
 */
export function isAnchorId(value: string): value is AnchorId {
  return (ANCHOR_IDS as readonly string[]).includes(value);
}
