// The sanctioned validation-sidecar stripper (GAME_ENGINE.md §3.2), the twin of the
// Lesson Engine's `stripAnswers()` (frontend/src/lesson-engine/core/strip.ts).
//
// IMPORTANT — what this is and is NOT. The Lesson Engine's secret (`segment.answer`)
// lives INSIDE the document, so `stripAnswers()` is the thing that removes it. The
// Game Engine's secret is `GameValidation`, which lives in a SEPARATE DB column
// (`game_documents.validation`) and is never part of `GameDocument` in the first
// place — which is why `game_documents` runs RLS-enabled with zero policies
// (service-role only): RLS is row-level, not column-level.
//
// So this function is a DEFENCE IN DEPTH, not the primary control. It gives:
//   (a) a type-level guarantee — the returned `ClientGameDocument` provably carries
//       no `validation` property, so a payload typed as one cannot silently grow it;
//   (b) a runtime guarantee — if a server bug ever merges the sidecar onto a document
//       object (a `SELECT *` row spread is the realistic way this happens), the key is
//       removed before the payload is serialized to a client.
//
// It strips exactly ONE key at the TOP LEVEL of the document. It does not deep-scan,
// and it cannot protect against a sidecar smuggled somewhere else (`content` carries
// an index signature for per-mechanic extras, for example). It is not a substitute
// for the RLS posture or for Core reading the two columns separately.

import type { GameDocument } from './types'

/** A document proven to carry no server-only sidecar — the only shape safe to send
 *  to a browser. `validation?: never` makes "add the sidecar back" a type error. */
export type ClientGameDocument = GameDocument & { validation?: never }

/** Remove a leaked `validation` sidecar from a document. Pure: the input is never
 *  mutated, and a document that never had the key is returned structurally identical. */
export function stripValidation(doc: GameDocument & { validation?: unknown }): ClientGameDocument {
  const { validation: _validation, ...rest } = doc
  return rest
}
