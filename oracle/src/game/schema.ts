import { z } from 'zod';
import { CHARACTER_IDS, LOCALES } from '../context/schema.js';

/*
 * THE THIRD DOOR (docs/games/KARTRUSH-INTEGRATION-DESIGN.md section 4.2).
 *
 * The one-line debrief after a game race sends the smallest thing of all to the
 * model: FOUR closed values, each an enum. There is no nickname, no id, no free
 * text, no number and no history to leave by accident, because the schema has
 * no place for them. It is a separate `.strict()` gate for the same reason the
 * generation brief has one: widening the 14-field conversational context
 * (pinned by `privacy-contract-docs.test.ts`) to carry this would loosen the
 * tighter gate, and every path to the model must pass A seal (`boundaries.test.ts`).
 * It lives beside the game code, not in context/, so the Mentor's context
 * contract is untouched.
 *
 * `lens` is the Decision Lens key Core chose on the server (docs/games/
 * KRV1-CONTRACT.md section 5): which one thing about the race to mention.
 * agent/tools/check-game-protocol-parity.mjs holds these lists equal to Core's.
 */
export const GAME_BANDS = ['6-9', '10-12', '13-17', 'adult'] as const;
export const GAME_LENS_KEYS = ['item_hold', 'drift_patient', 'drift_early', 'steady', 'swingy', 'neutral'] as const;

export const GameLineInputSchema = z
  .object({
    mentor: z.enum(CHARACTER_IDS),
    locale: z.enum(LOCALES),
    band: z.enum(GAME_BANDS),
    lens: z.enum(GAME_LENS_KEYS),
  })
  .strict();

export type GameLineInput = z.infer<typeof GameLineInputSchema>;

/** The one function allowed to produce a game-line-bound input. Throws, like `sealContext`. */
export function sealGameLine(candidate: unknown): GameLineInput {
  const parsed = GameLineInputSchema.safeParse(candidate);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`[oracle] refusing to send an invalid game line input — ${detail}`);
  }
  return parsed.data;
}
