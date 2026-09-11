import { describe, expect, it } from 'vitest';
import { TutorContextSchema } from '../context/schema.js';

/*
 * THE PRIVACY CONTRACT IS AN ENUMERATED ALLOW-LIST, AND IT MUST STAY CLOSED.
 *
 * `verify:tutor` already proves the schema REJECTS what is not on it. This
 * test pins WHAT is on it: the exact set of fields about a learner that may
 * reach a third-party language model. Widening that set is exactly the change
 * that should never pass quietly.
 */

const schemaKeys = Object.keys(TutorContextSchema.shape).sort();

describe('the tutor context schema stays a closed, deliberate allow-list', () => {
  it('is fourteen fields, and a change to that number is a decision', () => {
    /*
     * Deliberately a hard-coded list. Widening what reaches a third-party
     * model about a child should fail here on the next field, forcing the
     * person adding it to come here, read why, and make the addition an
     * explicit reviewed decision.
     *
     * History: 9 → 11 on 2026-08-28 (`planState`, `previousSessions`), → 12
     * the same day (`pedagogy`), → 14 on 2026-08-29 (`openActivity`,
     * `learnerBrief` — the first field derived from the child's own speech,
     * gated by blocking parental approval and append-only ledgered writes).
     */
    expect(schemaKeys).toEqual([
      'adaptations',
      'character',
      'courseContext',
      'intent',
      'learnerBrief',
      'locale',
      'nickname',
      'openActivity',
      'pedagogy',
      'planState',
      'previousSessions',
      'skillStates',
      'tier',
      'turnHistory',
    ]);
  });
});
