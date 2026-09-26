import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  RULES_CRITERIA,
  TRANSCRIPT_CRITERIA,
  TRANSCRIPT_RUBRIC,
  TRANSCRIPT_RUBRIC_HASH,
  TRANSCRIPT_RUBRIC_VERSION,
} from '../services/pedagogy/transcriptRubric.js';
import { declaresEmotion, foldTranscript, scoreSession, type SessionBundle } from '../services/pedagogy/transcriptScoring.js';
import { TRANSCRIPT_FIXTURES } from '../services/pedagogy/transcriptFixtures.js';
import { checkFixtures, judgeBatch } from '../scripts/evaluate-transcripts.js';

/*
 * S06.13 — C.21: the transcript rubric and its deterministic, zero-spend
 * scorer. The rubric is a Tier 1 artifact (Appendix E §3.1): its hash is
 * pinned to the written change record; every rule-scored criterion is proven
 * to both pass and fail on the hand-written fixtures; the emotion lexicon is
 * proven in three locales, including the sentences it must stay silent on.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POLICY = path.resolve(HERE, '../../../docs/rebuild/mentor/EVALUATION-LOOP-AND-QUALITY-DASHBOARD-POLICY.md');

describe('C.21 rubric governance (Tier 1)', () => {
  it('pins the rubric hash to the last row of the written change record', () => {
    const doc = readFileSync(POLICY, 'utf8');
    const section = doc.slice(doc.indexOf('### 2.2 Rubric change record'), doc.indexOf('## 3. Scoring'));
    const rows = [...section.matchAll(/^\| (v\d+) \| `([0-9a-f]{64})` \| (\d{4}-\d{2}-\d{2}) \|/gm)];
    expect(rows.length).toBeGreaterThan(0);
    const last = rows[rows.length - 1]!;
    expect(`mentor-transcript-rubric.${last[1]}`).toBe(TRANSCRIPT_RUBRIC_VERSION);
    // A rubric change without a new, signed-off row in the policy turns this red.
    expect(last[2]).toBe(TRANSCRIPT_RUBRIC_HASH);
  });

  it('keeps every criterion traceable, typed and scoreable by someone', () => {
    expect(new Set(TRANSCRIPT_CRITERIA).size).toBe(TRANSCRIPT_CRITERIA.length);
    for (const c of TRANSCRIPT_RUBRIC) {
      expect(c.requirement, c.id).toMatch(/^C\.\d{1,2}$/);
      expect(c.scoredBy.length, c.id).toBeGreaterThan(0);
      expect(c.judgeQuestion.length, c.id).toBeGreaterThan(20);
      if (c.kind === 'ceiling' || c.kind === 'floor') expect(c.target, c.id).not.toBeNull();
    }
    // Judge-only criteria are never produced by the rules scorer.
    expect(RULES_CRITERIA).not.toContain('tell_honored');
    expect(RULES_CRITERIA).not.toContain('scaffold_quality');
  });
});

describe('C.21 deterministic scorer on the fixture set', () => {
  it('scores every fixture exactly as its author intends', () => {
    const r = checkFixtures();
    expect(r.fixtures).toBe(TRANSCRIPT_FIXTURES.length);
    expect(r.checked).toBe(TRANSCRIPT_FIXTURES.length * RULES_CRITERIA.length);
    expect(r.mismatches).toEqual([]);
  });

  it('proves every rule-scored criterion can both pass and fail (a check that never fails measures nothing)', () => {
    for (const criterion of RULES_CRITERIA) {
      const outcomes = new Set(TRANSCRIPT_FIXTURES.flatMap((f) => scoreSession(f.bundle).filter((s) => s.criterion === criterion).map((s) => s.outcome)));
      const kind = TRANSCRIPT_RUBRIC.find((c) => c.id === criterion)!.kind;
      if (kind === 'diagnostic') {
        expect(outcomes.has('observed'), criterion).toBe(true);
      } else {
        expect(outcomes.has('pass'), `${criterion} never passes`).toBe(true);
        expect(outcomes.has('fail'), `${criterion} never fails`).toBe(true);
      }
    }
  });

  it('covers the three locales and every persona', () => {
    expect(new Set(TRANSCRIPT_FIXTURES.map((f) => f.bundle.session.locale))).toEqual(new Set(['en-US', 'es-MX', 'pt-BR']));
    expect(new Set(TRANSCRIPT_FIXTURES.map((f) => f.bundle.session.character))).toEqual(new Set(['dina', 'liruf', 'rho', 'zara']));
  });

  it('never invents an opportunity: an empty session is not applicable, not a pass', () => {
    const empty: SessionBundle = {
      session: { id: 's', character: 'dina', tier: 1, locale: 'en-US', close_reason: null, closing_script: null, ended_at: '2026-09-20T00:00:00Z' },
      turns: [],
      honesty: [],
      firings: [],
      alliance: null,
      selfExplanation: [],
      dialogue: null,
    };
    expect(scoreSession(empty).every((s) => s.outcome === 'not_applicable' && s.denominator === 0)).toBe(true);
  });

  it('counts a shadow firing as no opportunity, and an undelivered act firing as a miss', () => {
    const base = TRANSCRIPT_FIXTURES.find((f) => f.id === 'es-check-in-missed')!.bundle;
    const shadowOnly = scoreSession({ ...base, firings: [{ mode: 'shadow', outcome: 'shadow' }] }).find((s) => s.criterion === 'check_in');
    expect(shadowOnly?.outcome).toBe('not_applicable');
    const superseded = scoreSession({ ...base, firings: [{ mode: 'act', outcome: 'superseded' }] }).find((s) => s.criterion === 'check_in');
    expect(superseded?.outcome).toBe('not_applicable');
  });

  it('ignores a short repeated acknowledgement inside a ladder (only substantive hints count)', () => {
    const base = TRANSCRIPT_FIXTURES.find((f) => f.id === 'en-hint-repeated')!.bundle;
    const turns = base.turns.map((t) => (t.seq === 2 || t.seq === 4 ? { ...t, text: 'Okay, try.' } : t));
    expect(scoreSession({ ...base, turns }).find((s) => s.criterion === 'hint_repeat')?.outcome).toBe('pass');
  });

  it('keeps numerator within denominator for every score', () => {
    for (const f of TRANSCRIPT_FIXTURES) {
      for (const s of scoreSession(f.bundle)) expect(s.numerator, `${f.id}/${s.criterion}`).toBeLessThanOrEqual(s.denominator);
    }
  });
});

describe('C.9 declared-emotion lexicon (three locales)', () => {
  const declared = [
    'You seem frustrated. Let us slow down.',
    "I can tell you're really bored with this.",
    'You look tired today.',
    'It sounds like you are a bit lost.',
    'Pareces aburrido. Cambiemos de tema.',
    'Estás muy cansada, ¿verdad? Hagamos una pausa.',
    'Te noto nervioso con los números.',
    'Se nota que estás estresada.',
    'Você parece frustrado com isso.',
    'Você está meio entediada hoje.',
    'Parece que você está confuso.',
    'Te vejo cansado.',
    "You're tired, aren't you?",
    'Você está cansado, né?',
  ];
  const silent = [
    'Are you frustrated? We can try another way.',
    '¿Estás cansado? Podemos parar.',
    'Você está cansado? Podemos parar.',
    "Don't worry, mistakes help us learn.",
    'I was confused by this at first too.',
    'Estás a 3 monedas de tu meta.',
    'Você está certo: 12 moedas.',
    'You are doing the steps in order.',
    'That was a frustrating problem, and you kept going.',
    'Some people feel bored when a task repeats.',
    'Estás en el paso dos.',
    'Você está quase lá!',
    'Is this still working for you, or shall we change it?',
    '¿Te sientes cansada o seguimos?',
  ];
  it.each(declared)('flags: %s', (text) => expect(declaresEmotion(text)).toBe(true));
  it.each(silent)('stays silent: %s', (text) => expect(declaresEmotion(text)).toBe(false));

  it('folds diacritics and punctuation before reading', () => {
    expect(foldTranscript('¡Estás MUY cansada!')).toBe('estas muy cansada');
  });
});

describe('C.21 judge batch export (for the owner-run judge harness)', () => {
  it('carries the rubric with its hash and the fixture transcripts only, with no ids beyond the fixture names', () => {
    const batch = judgeBatch();
    expect(batch.kind).toBe('mentor-transcript-judge-batch');
    expect(batch.source).toBe('fixtures');
    expect(batch.rubric.hash).toBe(TRANSCRIPT_RUBRIC_HASH);
    expect(batch.rubric.criteria.map((c) => c.id)).toEqual(TRANSCRIPT_CRITERIA);
    expect(batch.transcripts).toHaveLength(TRANSCRIPT_FIXTURES.length);
    const serialized = JSON.stringify(batch);
    expect(serialized).not.toMatch(/"session_id"|"user_id"|"sessionId"/);
    for (const t of batch.transcripts) expect(Object.keys(t.intended).sort()).toEqual([...TRANSCRIPT_CRITERIA].sort());
  });
});
