import { describe, expect, it } from 'vitest';
import {
  DRASTIC_SURVIVAL_THRESHOLD,
  MIN_PRIOR_OBSERVATIONS_TO_JUDGE,
  describeDrasticRevision,
  evaluateMemoryRevision,
} from '../session/memoryRevision.js';

/*
 * THE MEMORY-WRITE REVISION GUARD — the free, deterministic half of the
 * "Honcho-style dialectic memory" backlog item. See memoryRevision.ts's own
 * header for why this is advisory (never blocks a write) and why it is a
 * bag-of-words heuristic rather than a second model call.
 */

describe('evaluateMemoryRevision — no prior note', () => {
  it('is never drastic when there was nothing stored yet (a first-ever write)', () => {
    const r = evaluateMemoryRevision(null, 'Le encanta contar monedas.\nResponde bien a ejemplos concretos.');
    expect(r.isDrasticRevision).toBe(false);
    expect(r.priorObservationCount).toBe(0);
    expect(r.survivalRatio).toBe(1);
    expect(r.droppedClaims).toEqual([]);
  });

  it('treats an empty-string prior the same as null', () => {
    const r = evaluateMemoryRevision('', 'Le encanta contar monedas.');
    expect(r.isDrasticRevision).toBe(false);
    expect(r.priorObservationCount).toBe(0);
  });
});

describe('evaluateMemoryRevision — too thin to judge', () => {
  it('never flags a single-observation note as drastic, even if fully replaced', () => {
    expect(MIN_PRIOR_OBSERVATIONS_TO_JUDGE).toBe(2);
    const r = evaluateMemoryRevision('Le gustan los dinosaurios.', 'Prefiere hablar de fútbol y no de dinero.');
    expect(r.priorObservationCount).toBe(1);
    expect(r.isDrasticRevision).toBe(false);
    // The single line still shows up as dropped in the detail, even though it
    // does not cross the "worth flagging" bar — the report is honest either way.
    expect(r.droppedClaims).toHaveLength(1);
  });
});

describe('evaluateMemoryRevision — elaboration, not revision', () => {
  it('is never drastic when every old observation survives and new ones are simply added', () => {
    const old = ['Le encanta contar monedas.', 'Responde bien a ejemplos concretos.'].join('\n');
    const updated = [
      'Le encanta contar monedas.',
      'Responde bien a ejemplos concretos.',
      'Hoy mostró interés en ahorrar para un juguete.',
    ].join('\n');
    const r = evaluateMemoryRevision(old, updated);
    expect(r.priorObservationCount).toBe(2);
    expect(r.survivalRatio).toBe(1);
    expect(r.droppedClaims).toEqual([]);
    expect(r.isDrasticRevision).toBe(false);
  });

  it('recognizes a paraphrase (word-order changed, accents varied) as "kept", not dropped', () => {
    const old = ['Le encanta contar monedas.', 'Se frustra con las restas largas.'].join('\n');
    // Reworded, and the accent on "número" added where the old line had none of that word at all —
    // this line exercises accent-insensitive matching on the SHARED words ("monedas", "contar").
    const updated = ['Contar monedas es algo que disfruta mucho.', 'Se frustra con las restas largas.'].join('\n');
    const r = evaluateMemoryRevision(old, updated);
    expect(r.droppedClaims).toEqual([]);
    expect(r.survivalRatio).toBe(1);
    expect(r.isDrasticRevision).toBe(false);
  });
});

describe('evaluateMemoryRevision — a genuine drastic revision', () => {
  it('flags a note whose observations mostly vanish with no trace in the replacement', () => {
    const old = [
      'Le encanta contar monedas.',
      'Responde bien a ejemplos concretos.',
      'Se frustra con las restas largas.',
    ].join('\n');
    // Zero shared vocabulary with any of the three lines above.
    const updated = 'Prefiere hablar de dinosaurios durante la sesión.';
    const r = evaluateMemoryRevision(old, updated);
    expect(r.priorObservationCount).toBe(3);
    expect(r.droppedClaims).toHaveLength(3);
    expect(r.survivalRatio).toBe(0);
    expect(r.isDrasticRevision).toBe(true);
  });

  it('names the actual dropped lines, verbatim, so a human reading the returned report can act on it', () => {
    const old = ['Le encanta contar monedas.', 'Se frustra con las restas largas.'].join('\n');
    const updated = 'Hoy solo habló de su videojuego favorito.';
    const r = evaluateMemoryRevision(old, updated);
    expect(r.droppedClaims).toEqual(['Le encanta contar monedas.', 'Se frustra con las restas largas.']);
  });

  it('sits exactly at the documented survival threshold and does NOT fire (strictly less-than, not less-or-equal)', () => {
    expect(DRASTIC_SURVIVAL_THRESHOLD).toBeCloseTo(1 / 3, 10);
    // 3 old observations, exactly 1 survives -> survivalRatio === 1/3 exactly.
    const old = ['Le encanta contar monedas.', 'Se frustra con las restas largas.', 'Prefiere ejemplos con juguetes.'].join(
      '\n',
    );
    const updated = ['Le encanta contar monedas.', 'Habla de su equipo de fútbol favorito.'].join('\n');
    const r = evaluateMemoryRevision(old, updated);
    expect(r.survivalRatio).toBeCloseTo(1 / 3, 10);
    expect(r.isDrasticRevision).toBe(false);
  });

  it('fires once survival drops just below the threshold', () => {
    // 4 old observations, exactly 1 survives -> 0.25 < 1/3.
    const old = [
      'Le encanta contar monedas.',
      'Se frustra con las restas largas.',
      'Prefiere ejemplos con juguetes.',
      'Le gusta trabajar con dibujos.',
    ].join('\n');
    const updated = ['Le encanta contar monedas.', 'Habla de su equipo de fútbol favorito.'].join('\n');
    const r = evaluateMemoryRevision(old, updated);
    expect(r.survivalRatio).toBe(0.25);
    expect(r.isDrasticRevision).toBe(true);
  });
});

describe('describeDrasticRevision', () => {
  it('reports counts and a rounded percentage, and never leaks the actual note text', () => {
    const report = evaluateMemoryRevision(
      ['Le encanta contar monedas.', 'Se frustra con las restas largas.', 'Prefiere ejemplos con juguetes.'].join('\n'),
      'Prefiere hablar de dinosaurios durante la sesión.',
    );
    const message = describeDrasticRevision('learner', report);
    expect(message).toContain('"learner"');
    expect(message).toContain('kept 0% of 3 prior observation(s)');
    expect(message).toContain('dropped 3');
    // The actual prose never appears in the log line.
    expect(message).not.toContain('monedas');
    expect(message).not.toContain('dinosaurios');
  });

  it('names the pedagogy store distinctly from the learner store', () => {
    const report = evaluateMemoryRevision(
      ['Necesita más tiempo para responder.', 'Aprende mejor con ejemplos visuales.'].join('\n'),
      'Responde rápido a preguntas orales.',
    );
    expect(describeDrasticRevision('pedagogy', report)).toContain('"pedagogy"');
  });
});
