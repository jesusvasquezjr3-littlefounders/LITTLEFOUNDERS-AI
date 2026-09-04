import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * THE LEDGER OF WHAT THE MODEL HAS ACTUALLY BEEN SEEN TO DRAW.
 *
 * WHY A LEDGER AND NOT A GATE ON ONE RUN. A board fires when the SITUATION for
 * it arises, and one conversation produces one situation — twelve
 * conversations will never produce forty-five. Requiring every kind in a
 * single `tutor:converse` run would be a flaky gate that measures which
 * scenarios happened to be scripted, not whether the product can reach the
 * board. So reachability is accumulated across runs, by evidence, and this
 * file guards the accumulation.
 *
 * WHAT IT ACTUALLY PROTECTS. Two things a green build otherwise misses:
 *
 *   1. A kind can be added to the schema, drawn correctly in the lab, gated by
 *      `instruments:check` across five copies, and still be something the
 *      model never once chooses. That was true of THIRTY-THREE kinds until
 *      2026-09-04, and nothing was red. `MISSING` below names the ones that
 *      are still in that state, out loud, instead of leaving the absence to be
 *      inferred from a count.
 *
 *   2. Coverage that was earned can be lost — a prompt edit, a strategy
 *      change, a move rewired. The ledger cannot shrink without this test
 *      failing, so a regression in what the tutor REACHES FOR is as loud as a
 *      regression in what it can render.
 *
 * HOW A KIND GETS IN. It is drawn by the real model in a real
 * `tutor:converse` run, and the run's own census prints it. Nothing else
 * counts — not a lab fixture, not a unit test, not an intention.
 */

interface Ledger {
  proven: string[];
}

const ledger = JSON.parse(
  readFileSync(new URL('../../board-reachability.json', import.meta.url), 'utf8'),
) as Ledger;

/** Every kind the schema accepts, read from the schema so the two cannot drift. */
const schemaKinds = [
  ...new Set(
    [...readFileSync(new URL('../tutor/turnSchema.ts', import.meta.url), 'utf8').matchAll(
      /z\.literal\('([a-z_]+)'\)/g,
    )].map((m) => m[1]!),
  ),
].sort();

describe('board reachability ledger', () => {
  it('records only kinds the schema actually accepts', () => {
    for (const kind of ledger.proven) {
      expect(schemaKinds, `ledger claims "${kind}", which is not a board kind`).toContain(kind);
    }
  });

  it('has no duplicates and is sorted, so a diff shows what changed', () => {
    expect(ledger.proven).toEqual([...new Set(ledger.proven)].sort());
  });

  /*
   * THE ANTI-REGRESSION FLOOR. Raise it when a run proves more; never lower it
   * to make a build pass. A drop means the tutor stopped reaching for
   * something it used to reach for, which is exactly the silent failure this
   * whole file exists to make loud.
   */
  const FLOOR = 45;

  it(`never loses ground — at least ${FLOOR} of ${schemaKinds.length} kinds stay proven reachable`, () => {
    expect(ledger.proven.length).toBeGreaterThanOrEqual(FLOOR);
  });

  it('leaves NO kind unproven — every board the schema accepts has been drawn by the real model', () => {
    /*
     * REACHED 45/45 on 2026-09-04, after four sweeps and one real correction:
     * `partition` resisted every attempt until its guidance was found to be
     * WRONG — written from the field names ("named shares that work out to
     * money") instead of from the schema's own documented purpose, which is
     * the SAME amount shared two different ways so a bigger denominator can be
     * watched making a smaller piece. The model was being told to draw
     * something the board does not do. Fixed, it drew on the next attempt.
     *
     * This assertion is now the guarantee: a kind added to the schema is
     * unproven until a real model draws it, and this fails until it does.
     */
    const missing = schemaKinds.filter((k) => !ledger.proven.includes(k));
    expect(missing, 'board kinds no real model run has ever drawn').toEqual([]);
  });
});
