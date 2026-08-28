import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TutorContextSchema } from '../context/schema.js';

/*
 * THE PRIVACY CONTRACT IS TWO DOCUMENTS AND ONE SCHEMA, AND THEY MUST AGREE.
 *
 * `/ORACLE.md` §4.1 calls itself "the complete allowed set". A brief for
 * counsel, `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` §2.2, calls itself "the complete
 * set of learner data sent to a language model". Both listed eight fields; the
 * schema has nine. `character` had been in the sealed context and in the prompt
 * since the runtime was built, and neither document mentioned it.
 *
 * The omission was harmless in substance — a character id says nothing about a
 * learner — and serious in kind. The entire value of an enumerated allow-list
 * is that it is exhaustive: a reader who spot-checks one field and finds it
 * absent has no reason to trust the other eight, and counsel is signing off on
 * the list, not on the code.
 *
 * `verify:tutor` already proves the schema REJECTS what is not on it. Nothing
 * proved the documents LIST what is. This does. It is the same discipline the
 * 2026-08-23 audit arrived at the hard way: when a document names a control,
 * name the test that pins it.
 */

const ROOT = resolve(import.meta.dirname, '../../..');

const DOCS = [
  { name: 'ORACLE.md §4.1', path: 'ORACLE.md' },
  { name: 'LEGAL/AI_TUTOR_LEGAL_REVIEW.md §2.2', path: 'LEGAL/AI_TUTOR_LEGAL_REVIEW.md' },
] as const;

/**
 * How each schema key is written in prose. The documents are for humans — and
 * counsel's copy deliberately says "Age band" rather than `tier` — so a raw
 * key-name grep would force the brief to read like a type definition. Each
 * entry is the set of spellings that count as naming the field; at least one
 * must appear.
 */
const SPELLINGS: Record<string, readonly string[]> = {
  nickname: ['`nickname`', 'Nickname'],
  tier: ['`tier`', 'Age band'],
  locale: ['`locale`', 'Language'],
  character: ['`character`', 'Chosen character'],
  intent: ['`intent`', 'Intent'],
  adaptations: ['`adaptations`', 'Accessibility preferences'],
  courseContext: ['`courseContext`', 'Course context'],
  skillStates: ['`skillStates`', 'Derived skill state'],
  turnHistory: ['`turnHistory`', "This session's turns"],
  planState: ['`planState`', 'Lesson plan state'],
  previousSessions: ['`previousSessions`', 'Previous-session digests'],
};

const schemaKeys = Object.keys(TutorContextSchema.shape).sort();

describe('the privacy contract documents enumerate exactly what the schema permits', () => {
  it('has a documented spelling for every schema key', () => {
    // Guards the guard: a field added to the schema with no entry here would
    // otherwise be silently exempt from the checks below.
    expect(Object.keys(SPELLINGS).sort()).toEqual(schemaKeys);
  });

  for (const doc of DOCS) {
    it(`${doc.name} names all ${schemaKeys.length} fields that reach the model`, () => {
      const text = readFileSync(resolve(ROOT, doc.path), 'utf8');
      const missing = schemaKeys.filter(
        (key) => !SPELLINGS[key].some((spelling) => text.includes(spelling)),
      );

      expect(
        missing,
        `${doc.path} does not name: ${missing.join(', ')}. A field was added to ` +
          `TutorContextSchema without updating the document that calls itself the ` +
          `complete allowed set. /ORACLE.md §17 requires both, in the same commit.`,
      ).toEqual([]);
    });
  }

  it('is eleven fields, and a change to that number is a decision', () => {
    /*
     * Deliberately a hard-coded number. Widening what reaches a third-party
     * model about a child is exactly the change that should not pass quietly:
     * this fails on the next field and the person adding it has to come here,
     * read why, and update /ORACLE.md §4.1, the legal brief §2.2, and this
     * line — which is the review the number exists to force.
     *
     * Went 9 → 11 on 2026-08-28 (owner sign-off): `planState` (server-derived
     * lesson-plan projection, no new learner data) and `previousSessions`
     * (strict prior-session digests — topic/skills/outcome/counters, never a
     * transcript). Both went through exactly this review: §4.1 rows, legal
     * §2.2 items 10-11, and this list, in one commit.
     */
    expect(schemaKeys).toEqual([
      'adaptations',
      'character',
      'courseContext',
      'intent',
      'locale',
      'nickname',
      'planState',
      'previousSessions',
      'skillStates',
      'tier',
      'turnHistory',
    ]);
  });
});
