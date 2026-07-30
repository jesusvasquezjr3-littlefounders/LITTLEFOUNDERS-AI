// The canon four character ids — a PARITY COPY of the two symbols
// `frontend/src/components/characters/control/types.ts` exports that the game
// document contract depends on (`GameMeta.cast` and `characterIdEnum`).
//
// Why a separate module rather than an import: the frontend original also carries
// the emotion/action vocabulary and the per-character native prop maps, which are
// RENDERING concerns a generation service has no business holding. Copying only the
// closed id set keeps Arcade free of the rig while `npm run contract:check` still
// fails the moment the frontend's list changes (it diffs `CHARACTER_IDS` symbol-wise
// against the original).

export const CHARACTER_IDS = ['dina', 'liruf', 'rho', 'zara'] as const
export type CharacterId = (typeof CHARACTER_IDS)[number]
