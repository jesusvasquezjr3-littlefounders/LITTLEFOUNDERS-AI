import { describe, expect, it } from 'vitest';
import { TELEMETRY_DEFAULTS } from '../tutor/behavioralTelemetry.js';
import {
  DEFAULT_TO_INACTION_FLOOR,
  EMOTION_LABEL,
  runTelemetryGym,
  runTelemetryPersona,
  TELEMETRY_PERSONAS,
} from '../tutor/telemetryGym.js';

/*
 * C.9 / C.19 against Appendix F Part 3 Stage 2's simulated learners. Every
 * persona must pass on the proposed defaults AND must be able to FAIL: a
 * persona no regression can turn red is decoration, so each expected
 * behaviour is also proven against a deliberately broken layer.
 *
 * This file is also the C.9 Definition of Done (b) adversarial test: the
 * layer outputs no declarative emotion label anywhere across the full suite.
 */

const persona = (name: string) => TELEMETRY_PERSONAS.find((p) => p.name === name)!;

describe('the Behavioral Telemetry Layer against the simulated learners', () => {
  it('passes every persona on the proposed defaults, above the default-to-inaction floor', () => {
    const { reports, defaultToInaction, ok } = runTelemetryGym();
    expect(reports.flatMap((r) => r.problems.map((p) => `${r.persona}: ${p}`))).toEqual([]);
    expect(reports.map((r) => r.persona).sort()).toEqual(
      ['careless', 'disengaging', 'frustrated', 'gaming', 'masking', 'productive_struggle', 'reactant_teen', 'steady'],
    );
    expect(defaultToInaction).toBeGreaterThanOrEqual(DEFAULT_TO_INACTION_FLOOR);
    expect(ok).toBe(true);
  });

  it('C.9 DoD (b): no output of the layer, for any persona, carries an emotion label', () => {
    const { reports } = runTelemetryGym();
    for (const report of reports) {
      expect(JSON.stringify(report.readings), report.persona).not.toMatch(EMOTION_LABEL);
    }
    // …and the check really looks: a label smuggled into a reading is caught.
    expect(JSON.stringify({ state: 'frustrated' })).toMatch(EMOTION_LABEL);
    expect(JSON.stringify({ estado: 'aburrido' })).toMatch(EMOTION_LABEL);
    expect(JSON.stringify({ estado: 'entediado' })).toMatch(EMOTION_LABEL);
  });

  it('checks in on the disengaging, frustrated, gaming and masking learners, early', () => {
    for (const name of ['disengaging', 'frustrated', 'gaming', 'masking']) {
      const report = runTelemetryPersona(persona(name));
      expect(report.checkIns.length, name).toBeGreaterThan(0);
      expect(report.checkIns[0]!, name).toBeLessThanOrEqual(10);
    }
  });

  it('honours the reactant teen: a terse baseline never fires, and the drift at most maxCheckIns times', () => {
    const report = runTelemetryPersona(persona('reactant_teen'));
    expect(report.checkIns[0]!).toBeGreaterThan(8);
    expect(report.checkIns.length).toBeLessThanOrEqual(TELEMETRY_DEFAULTS.maxCheckIns);
  });

  it('turns red when the layer goes deaf (the learners who need a check-in never get one)', () => {
    const deaf = { ...TELEMETRY_DEFAULTS, countThreshold: 100, verbosityDropFull: 100 };
    for (const name of ['disengaging', 'frustrated', 'gaming', 'masking', 'reactant_teen']) {
      expect(runTelemetryPersona(persona(name), deaf).problems.length, name).toBeGreaterThan(0);
    }
  });

  it('turns red when the layer is hypersensitive (the steady learner is pestered)', () => {
    const hyper = { ...TELEMETRY_DEFAULTS, minChannels: 1, countThreshold: 1, verbosityDropFull: 0.2, latencyZ: 0.3 };
    expect(runTelemetryPersona(persona('steady'), hyper).problems.length).toBeGreaterThan(0);
  });

  it('turns red when productive slowness is read as disengagement', () => {
    const broken = { ...TELEMETRY_DEFAULTS, productiveSlownessExempt: false, minChannels: 1 };
    expect(runTelemetryPersona(persona('productive_struggle'), broken).problems.length).toBeGreaterThan(0);
  });

  it('turns red when carelessness is fused into the disengagement signal', () => {
    const broken = { ...TELEMETRY_DEFAULTS, carelessnessFused: true, minChannels: 1 };
    expect(runTelemetryPersona(persona('careless'), broken).problems.length).toBeGreaterThan(0);
  });

  it('turns red when the re-arm window and the cap are removed (the teen is pestered)', () => {
    const broken = { ...TELEMETRY_DEFAULTS, rearmAfterObservations: 0, maxCheckIns: 10 };
    expect(runTelemetryPersona(persona('reactant_teen'), broken).problems.length).toBeGreaterThan(0);
  });
});
