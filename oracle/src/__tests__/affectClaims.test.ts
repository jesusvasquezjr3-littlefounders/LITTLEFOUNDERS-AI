import { describe, expect, it } from 'vitest';
import { claimsLearnerAffect } from '../tutor/affectClaims.js';

/*
 * Block C non-negotiable (Appendix D §1.7): the Mentor never issues a
 * declarative claim about the learner's emotional state. The session-end
 * offer (C.8/C.12) is where a helpful model reaches for "you seem tired", so
 * the delivered text is checked, not only instructed. These pin what counts
 * as a claim in all three locales, and — just as important — what does not:
 * a question, a conditional, talk about someone else or about the Mentor.
 */

describe('declarations about how the learner feels are caught', () => {
  it.each([
    'You seem tired. Want to stop here for today, or do one more?',
    "You're getting a bit bored, so let's switch.",
    'You look really frustrated with this one.',
    'I can tell you are confused.',
    "You're exhausted after all that work!",
    'Te ves cansado. ¿Paramos por hoy o hacemos una más?',
    'Pareces un poco aburrida con esto.',
    'Se nota que estás frustrado.',
    'Estás muy distraído hoy.',
    'Você parece cansado. Vamos parar por hoje?',
    'Percebo que você está entediada.',
    'Você está um pouco confuso com isso.',
  ])('%s', (text) => {
    expect(claimsLearnerAffect(text)).toBe(true);
  });
});

describe('what is NOT a declaration is left alone', () => {
  it.each([
    // Questions are check-ins (C.19), not claims.
    'Are you tired? We can stop here or do one more.',
    '¿Estás cansado? Podemos parar o hacer una más.',
    'Você está cansado? Podemos parar ou fazer mais uma.',
    // Conditionals.
    "If you're confused, that is completely okay.",
    'Si estás cansado, paramos cuando quieras.',
    'Se você está cansado, a gente para quando quiser.',
    // Neither the learner nor a state.
    'Want to stop here for today, or do one more?',
    'That was a tricky one. Let us look at it together.',
    'The farmer was tired after the harvest.',
    'I get tired of counting coins too!',
    'You are doing the work, step by step.',
  ])('%s', (text) => {
    expect(claimsLearnerAffect(text)).toBe(false);
  });
});
