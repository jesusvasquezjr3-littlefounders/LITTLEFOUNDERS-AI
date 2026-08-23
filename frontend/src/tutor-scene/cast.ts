import type { CharacterId } from '@/components/characters/control/types';

/*
 * WHO IS STANDING ON THE ISLAND — one rule, in one place, imported by both the
 * product and the gate that certifies it.
 *
 * It was four lines inside `TutorScene`, which is a React component that
 * imports three.js and react-three-fiber, so `scripts/verify-placement.ts`
 * could not reach it and had to hard-code its own idea of the cast instead. A
 * gate holding its own copy of the rule certifies a slightly different product
 * — the same reason the solver, the separation arithmetic and the facing rule
 * are all imported there rather than reimplemented.
 *
 * The distinction this file exists to make explicit: during a personalization
 * audition the cast is the CATALOG, and it does not depend on who the session's
 * tutor or companion currently is. Inviting a candidate to stay changes their
 * ROLE and nothing about where anybody stands. That is a property the placement
 * gate can now sweep rather than a fact somebody has to remember, and it is the
 * property the ship-blocker of 2026-08-22 turned out to violate everywhere
 * except here: placement was right, and the character was remounted anyway.
 *
 * This module imports nothing but a type, so a headless script can hold it.
 */

/**
 * Everyone to place, in the order their marks are assigned.
 *
 * During an audition that is the whole catalog, in catalog order, so a name
 * plate keeps the same mark whoever is currently chosen: a candidate who moved
 * when you picked somebody else would make the next choice a hunt. The tutor is
 * appended if the catalog somehow does not contain them, because a session with
 * nobody to talk to is a worse failure than an unmarked extra.
 *
 * Outside an audition it is the tutor and their companion — and the companion
 * is dropped when they ARE the tutor, since one person cannot stand in two
 * places and a duplicate would take a second standing spot away from somebody
 * who needs one.
 */
export function standingCast(
  audition: readonly CharacterId[] | null,
  character: CharacterId,
  companion: CharacterId | null,
): readonly CharacterId[] {
  if (audition && audition.length > 0) {
    return audition.includes(character) ? audition : [...audition, character];
  }
  return companion && companion !== character ? [character, companion] : [character];
}
