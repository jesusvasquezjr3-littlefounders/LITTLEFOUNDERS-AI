import { describe, expect, it } from 'vitest';
import { runSessionEndGym, runSessionEndPersona, SESSION_END_PERSONAS } from '../tutor/sessionEndGym.js';
import { SESSION_END_SIGNAL_DEFAULTS } from '../tutor/sessionEndSignal.js';

/*
 * C.8/C.12 against Appendix F Part 3 Stage 2's simulated learners. The
 * personas must pass on the shipped defaults, AND each must be able to FAIL:
 * a persona that no regression can turn red is decoration, so every expected
 * behaviour is also proven against a deliberately broken signal.
 */

const persona = (name: string) => SESSION_END_PERSONAS.find((p) => p.name === name)!;

describe('the session-end signal against the simulated learners', () => {
  it('passes every persona on the proposed defaults', () => {
    const { reports, ok } = runSessionEndGym();
    expect(reports.flatMap((r) => r.problems.map((p) => `${r.persona}: ${p}`))).toEqual([]);
    expect(ok).toBe(true);
    expect(reports.map((r) => r.persona).sort()).toEqual(
      ['disengaging', 'frustrated', 'gaming', 'masking', 'reactant_teen', 'slipping', 'steady'],
    );
  });

  it('offers the disengaging learner a stop well before the hard cap, once', () => {
    const report = runSessionEndPersona(persona('disengaging'));
    expect(report.offers).toHaveLength(1);
    expect(report.offers[0].minute).toBeLessThan(20);
  });

  it('honours the reactant teen: at most maxOffers, never inside the re-arm window', () => {
    const report = runSessionEndPersona(persona('reactant_teen'));
    expect(report.offers.length).toBeGreaterThan(0);
    expect(report.offers.length).toBeLessThanOrEqual(SESSION_END_SIGNAL_DEFAULTS.maxOffers);
    for (let i = 1; i < report.offers.length; i++) {
      expect(report.offers[i].observation - report.offers[i - 1].observation).toBeGreaterThanOrEqual(
        SESSION_END_SIGNAL_DEFAULTS.rearmAfterObservations,
      );
    }
  });

  it('turns red when the latency half of the signature is dropped (the slipping learner is told to stop)', () => {
    const broken = { ...SESSION_END_SIGNAL_DEFAULTS, latencyVariabilityRise: -10 };
    expect(runSessionEndPersona(persona('slipping'), broken).problems.length).toBeGreaterThan(0);
  });

  it('turns red when surprising misses are ignored (the disengaging learner is never offered)', () => {
    const broken = { ...SESSION_END_SIGNAL_DEFAULTS, surpriseRateRise: 2 };
    expect(runSessionEndPersona(persona('disengaging'), broken).problems.length).toBeGreaterThan(0);
  });

  it('turns red when every miss counts as surprising (the frustrated learner is told to stop)', () => {
    const broken = { ...SESSION_END_SIGNAL_DEFAULTS, surpriseProbability: 0 };
    expect(runSessionEndPersona(persona('frustrated'), broken).problems.length).toBeGreaterThan(0);
  });

  it('turns red when the re-arm window is removed (the teen is pestered)', () => {
    const broken = { ...SESSION_END_SIGNAL_DEFAULTS, rearmAfterObservations: 0, maxOffers: 10 };
    expect(runSessionEndPersona(persona('reactant_teen'), broken).problems.length).toBeGreaterThan(0);
  });
});
