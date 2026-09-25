import { describe, expect, it } from 'vitest';
import {
  CLOSING_SCRIPT_FOR_REASON,
  CLOSING_SCRIPTS,
  closingScriptFor,
  EFFORT_ACTS,
  EMPTY_SESSION_CLOSING,
  SESSION_OPENINGS,
  SessionCloser,
  SessionClosingSnapshotSchema,
} from '../tutor/sessionClosing.js';
import {
  completedCloseResponse,
  completedCloseText,
  interruptedCloseResponse,
  interruptedCloseText,
  openingResponse,
  recapPromptResponse,
  recapPromptText,
  safetyStopCloseResponse,
  scriptedLineCatalogue,
} from '../tutor/scripted.js';
import { CHARACTER_IDS, LOCALES, type Locale } from '../context/schema.js';
import type { CloseReason } from '../core/client.js';

/*
 * C.16 — four end-reason-specific closing scripts (Appendix D §3.5).
 *
 * Pins: every close reason maps to exactly one of the four scripts (the
 * Session-Closing Script Accuracy metric is measured against this table);
 * the completed close names an act the server observed, most specific first,
 * and never claims one it did not; the safety close is calm and never the
 * positive template; and every scripted closing/opening line fits the Mentor
 * copy budget for the YOUNGEST band (Frontend Bible 06 §3.1), so one line
 * serves every age.
 */

const ALL_REASONS: CloseReason[] = [
  'completed',
  'soft_budget',
  'hard_budget',
  'learner_left',
  'abandoned',
  'consent_revoked',
  'safety_stop',
  'error',
];

/** Frontend Bible 06 §3: a word is any run of letters or digits. */
const words = (text: string) => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
const sentenceCount = (text: string) =>
  text.split(/[.!?…]+(?:\s|$)/u).filter((part) => /[\p{L}\p{N}]/u.test(part)).length;
/** The Mentor budget for ages 6–9: 12 English words, ×1.25 for es-MX and pt-BR, 2 sentences. */
const mentorLimit = (locale: Locale) => Math.ceil(12 * (locale === 'en-US' ? 1 : 1.25));

describe('close reason → closing script', () => {
  it('maps every close reason Core accepts to exactly one of the four scripts', () => {
    expect(Object.keys(CLOSING_SCRIPT_FOR_REASON).sort()).toEqual([...ALL_REASONS].sort());
    for (const reason of ALL_REASONS) expect(CLOSING_SCRIPTS).toContain(closingScriptFor(reason));
    // Every script is reachable.
    expect(new Set(Object.values(CLOSING_SCRIPT_FOR_REASON))).toEqual(new Set(CLOSING_SCRIPTS));
  });

  it('routes the involuntary endings to their own scripts', () => {
    expect(closingScriptFor('safety_stop')).toBe('safety_stop');
    expect(closingScriptFor('hard_budget')).toBe('interrupted');
    expect(closingScriptFor('learner_left')).toBe('learner_left');
    expect(closingScriptFor('abandoned')).toBe('learner_left');
    expect(closingScriptFor('completed')).toBe('completed');
  });
});

describe('SessionCloser — the act a completed close names', () => {
  it('claims nothing when nothing happened', () => {
    expect(new SessionCloser().effortAct()).toBe('none');
  });

  it('names an open conversation only when the learner actually said something', () => {
    const closer = new SessionCloser();
    closer.noteLearnerTurn();
    expect(closer.effortAct()).toBe('talked_through');
  });

  it('prefers graded work, then hint-then-solved, then a recovery, then corroborated mastery', () => {
    const closer = new SessionCloser();
    closer.noteGraded({ skill: 'a', correct: true, hintAssisted: false });
    expect(closer.effortAct()).toBe('kept_going');
    closer.noteGraded({ skill: 'b', correct: true, hintAssisted: true });
    expect(closer.effortAct()).toBe('hint_then_solved');
    closer.noteGraded({ skill: 'c', correct: false, hintAssisted: false });
    expect(closer.effortAct()).toBe('hint_then_solved');
    closer.noteGraded({ skill: 'c', correct: true, hintAssisted: false });
    expect(closer.effortAct()).toBe('recovered');
    closer.noteCorroboratedMastery();
    expect(closer.effortAct()).toBe('corroborated');
  });

  it('does not call a correct answer on a DIFFERENT skill a recovery', () => {
    const closer = new SessionCloser();
    closer.noteGraded({ skill: 'a', correct: false, hintAssisted: false });
    closer.noteGraded({ skill: 'b', correct: true, hintAssisted: false });
    expect(closer.effortAct()).toBe('kept_going');
  });

  it('round-trips through the park snapshot', () => {
    const closer = new SessionCloser();
    closer.noteGraded({ skill: 'a', correct: false, hintAssisted: false });
    closer.phase = 'recap_asked';
    const restored = new SessionCloser();
    restored.restore(SessionClosingSnapshotSchema.parse(JSON.parse(JSON.stringify(closer.snapshot()))));
    expect(restored.snapshot()).toEqual(closer.snapshot());
    expect(restored.phase).toBe('recap_asked');
    expect(SessionClosingSnapshotSchema.parse(EMPTY_SESSION_CLOSING)).toEqual(EMPTY_SESSION_CLOSING);
  });
});

describe('the scripted closing and opening lines', () => {
  const allTexts = (locale: Locale) => [
    recapPromptText(locale),
    interruptedCloseText(locale),
    safetyStopCloseResponse(locale).say,
    ...EFFORT_ACTS.map((act) => completedCloseText(locale, act)),
    ...SESSION_OPENINGS.filter((o) => o !== 'greeting').map((o) => openingResponse('rho', locale, o).say),
  ];

  it('fit the Mentor copy budget for ages 6–9 in every locale (Bible 06 §3.1)', () => {
    for (const locale of LOCALES) {
      for (const text of allTexts(locale)) {
        expect(words(text), `${locale}: "${text}"`).toBeLessThanOrEqual(mentorLimit(locale));
        expect(sentenceCount(text), `${locale}: "${text}"`).toBeLessThanOrEqual(2);
        expect(text.includes('—'), `${locale}: "${text}" has an em dash`).toBe(false);
        // One question per Mentor turn.
        expect((text.match(/\?/g) ?? []).length, `${locale}: "${text}"`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never reuses the old positive template, and the safety close carries no praise', () => {
    for (const locale of LOCALES) {
      for (const text of allTexts(locale)) {
        expect(text).not.toMatch(/great work|trabajamos muy bien|trabalhou muito bem|you worked hard|te esforzaste/i);
      }
      const safety = safetyStopCloseResponse(locale);
      expect(safety.say).not.toMatch(/great|good job|well done|bien hecho|muy bien|muito bem|parab[ée]ns|felicidades|!/i);
      expect(safety.emotion).toBe('neutral');
      expect(safety.next).toBe('close');
    }
  });

  it('closes warmly without celebrating (no celebration outside the milestone list, OD-7)', () => {
    for (const locale of LOCALES) {
      for (const act of EFFORT_ACTS) {
        const turn = completedCloseResponse(locale, act);
        expect(turn.next).toBe('close');
        expect(turn.action).not.toBe('celebrate');
        expect(turn.emotion).not.toBe('excited');
      }
      expect(interruptedCloseResponse(locale).next).toBe('close');
      // The recap QUESTION keeps the session open for one answer.
      expect(recapPromptResponse(locale).next).not.toBe('close');
    }
  });

  it('the interrupted close names the re-entry point', () => {
    expect(interruptedCloseText('en-US')).toMatch(/next time.*pick up/i);
    expect(interruptedCloseText('es-MX')).toMatch(/próxima.*seguimos/i);
    expect(interruptedCloseText('pt-BR')).toMatch(/próxima.*continuamos/i);
  });

  it('every closing and opening line is in the pre-generated catalogue for every character', () => {
    const catalogue = scriptedLineCatalogue();
    for (const character of CHARACTER_IDS) {
      for (const locale of LOCALES) {
        const texts = new Set(catalogue.filter((l) => l.character === character && l.locale === locale).map((l) => l.text));
        for (const text of allTexts(locale)) expect(texts.has(text), `${character}/${locale}: ${text}`).toBe(true);
      }
    }
  });
});
