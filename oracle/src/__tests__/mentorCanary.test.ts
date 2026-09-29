import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyCanary, clampTier2, MentorCanarySchema, type CanaryConfigs } from '../tutor/mentorCanary.js';
import { TIER2_PARAMETERS } from '../tutor/tier2Parameters.generated.js';
import { TELEMETRY_DEFAULTS } from '../tutor/behavioralTelemetry.js';
import { ALLIANCE_DEFAULTS } from '../tutor/allianceController.js';
import { SELF_EXPLANATION_DEFAULTS } from '../tutor/selfExplanation.js';
import { TutorOrchestrator } from '../tutor/orchestrator.js';
import { SessionContextSchema, type SessionContext } from '../core/client.js';
import type { SpeechResult } from '../voice/speech.js';

/*
 * C.22 / Appendix F Stage 5: the canary delivery path, Oracle's half. A
 * canary arm moves registered Tier 2 parameters only, clamped to the
 * registry's approved bounds; any other key refuses the whole canary.
 */

const REGISTRY = JSON.parse(
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/rebuild/mentor/governance/registry.json'), 'utf8'),
) as { tier2Parameters: { id: string; object: string; field: string; bounds: [number, number]; integer: boolean }[] };

const PROPOSAL = 'P-2026-10-01-latency-z';
const ADULT = { isMinor: false } as const;

const SESSION: SessionContext = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  tier: 3,
  locale: 'en-US',
  nickname: 'Sam',
  character: 'rho',
  companion: null,
  diorama: 'diorama-a',
  intent: 'open',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  isMinor: false,
  voiceConsent: false,
  intelDegraded: false,
};

const silent = async (): Promise<SpeechResult> => ({ url: null, source: 'unavailable', billedChars: 0, wordTimings: null });
const configsOf = (o: TutorOrchestrator): CanaryConfigs => (o as unknown as { canary: CanaryConfigs }).canary;

describe('the generated Tier 2 table', () => {
  it('is exactly the registry tier2Parameters (ids, objects, fields, bounds, integer)', () => {
    expect(Object.keys(TIER2_PARAMETERS)).toEqual(REGISTRY.tier2Parameters.map((p) => p.id));
    for (const p of REGISTRY.tier2Parameters) {
      expect(TIER2_PARAMETERS[p.id as keyof typeof TIER2_PARAMETERS]).toEqual({
        object: p.object,
        field: p.field,
        min: p.bounds[0],
        max: p.bounds[1],
        integer: p.integer,
      });
    }
  });

  it('every default sits inside its own bounds', () => {
    const objects = { TELEMETRY_DEFAULTS, ALLIANCE_DEFAULTS, SELF_EXPLANATION_DEFAULTS } as unknown as Record<string, Record<string, number>>;
    for (const [id, p] of Object.entries(TIER2_PARAMETERS)) {
      const value = objects[p.object]![p.field]!;
      expect(value, id).toBeGreaterThanOrEqual(p.min);
      expect(value, id).toBeLessThanOrEqual(p.max);
    }
  });
});

describe('applyCanary', () => {
  it('no canary: the approved defaults, nothing reported', () => {
    const c = applyCanary(null);
    expect(c.telemetry).toEqual(TELEMETRY_DEFAULTS);
    expect(c.alliance).toEqual(ALLIANCE_DEFAULTS);
    expect(c.selfExplanation).toEqual(SELF_EXPLANATION_DEFAULTS);
    expect(c.report).toBeNull();
  });

  it('a canary arm moves exactly the named parameters and reports the arm', () => {
    const c = applyCanary({ proposalId: PROPOSAL, arm: 'canary', overrides: { 'telemetry.latencyZ': 1.7, 'alliance.renegotiateAfterDeclines': 3 } }, ADULT);
    expect(c.telemetry.latencyZ).toBe(1.7);
    expect(c.alliance.renegotiateAfterDeclines).toBe(3);
    expect({ ...c.telemetry, latencyZ: TELEMETRY_DEFAULTS.latencyZ }).toEqual(TELEMETRY_DEFAULTS);
    expect(c.selfExplanation).toEqual(SELF_EXPLANATION_DEFAULTS);
    expect(c.report).toEqual({ proposalId: PROPOSAL, arm: 'canary' });
    // The shared defaults are never mutated.
    expect(TELEMETRY_DEFAULTS.latencyZ).toBe(1.5);
  });

  it('clamps a value to the registry bounds and rounds an integer parameter', () => {
    expect(clampTier2('telemetry.latencyZ', 9)).toBe(2.5);
    expect(clampTier2('telemetry.latencyZ', 0.1)).toBe(1);
    expect(clampTier2('selfExplanation.maxPerSession', 40)).toBe(6);
    expect(clampTier2('telemetry.minChannels', 2.6)).toBe(3);
    const c = applyCanary({ proposalId: PROPOSAL, arm: 'canary', overrides: { 'telemetry.maxCheckIns': 12, 'selfExplanation.minSpacingTurns': -4 } }, ADULT);
    expect(c.telemetry.maxCheckIns).toBe(3);
    expect(c.selfExplanation.minSpacingTurns).toBe(2);
  });

  it('refuses the WHOLE canary when any key is not a registered Tier 2 parameter', () => {
    for (const key of ['telemetry.windowSize', 'moderation.skip', 'corroborationMinObservations', '__proto__', 'constructor']) {
      const c = applyCanary({ proposalId: PROPOSAL, arm: 'canary', overrides: { 'telemetry.latencyZ': 1.7, [key]: 1 } }, ADULT);
      expect(c.report, key).toBeNull();
      expect(c.refused, key).toMatch(/not a registered Tier 2 parameter/);
      expect(c.telemetry, key).toEqual(TELEMETRY_DEFAULTS);
    }
  });

  it('refuses any canary, control arm included, for a session in the minor posture (OD-23)', () => {
    const arms: { proposalId: string; arm: 'canary' | 'control'; overrides: Record<string, number> }[] = [
      { proposalId: PROPOSAL, arm: 'canary', overrides: { 'telemetry.latencyZ': 1.7 } },
      { proposalId: PROPOSAL, arm: 'control', overrides: {} },
    ];
    for (const canary of arms) {
      const c = applyCanary(canary, { isMinor: true });
      expect(c.report, canary.arm).toBeNull();
      expect(c.applied, canary.arm).toEqual({});
      expect(c.refused, canary.arm).toMatch(/minor posture/);
      expect(c.telemetry, canary.arm).toEqual(TELEMETRY_DEFAULTS);
    }
    // No posture given: the safe default (minor) applies.
    expect(applyCanary({ proposalId: PROPOSAL, arm: 'canary', overrides: { 'telemetry.latencyZ': 1.7 } }).report).toBeNull();
  });

  it('the control arm runs the defaults and reports the control arm', () => {
    const c = applyCanary({ proposalId: PROPOSAL, arm: 'control', overrides: {} }, ADULT);
    expect(c.telemetry).toEqual(TELEMETRY_DEFAULTS);
    expect(c.report).toEqual({ proposalId: PROPOSAL, arm: 'control' });
  });
});

describe('the context field', () => {
  it('parses a canary and a control arm', () => {
    expect(SessionContextSchema.safeParse({ ...SESSION, canary: { proposalId: PROPOSAL, arm: 'canary', overrides: { 'telemetry.latencyZ': 1.7 } } }).success).toBe(true);
    expect(SessionContextSchema.safeParse({ ...SESSION, canary: { proposalId: PROPOSAL, arm: 'control', overrides: {} } }).success).toBe(true);
    expect(SessionContextSchema.safeParse({ ...SESSION, canary: null }).success).toBe(true);
  });

  it.each([
    ['an unknown field', { proposalId: PROPOSAL, arm: 'canary', overrides: { 'telemetry.latencyZ': 1.7 }, learnerAge: 30 }],
    ['a control arm with overrides', { proposalId: PROPOSAL, arm: 'control', overrides: { 'telemetry.latencyZ': 1.7 } }],
    ['a canary arm with no override', { proposalId: PROPOSAL, arm: 'canary', overrides: {} }],
    ['an unknown arm', { proposalId: PROPOSAL, arm: 'treatment', overrides: {} }],
    ['a malformed proposal id', { proposalId: 'latency', arm: 'control', overrides: {} }],
    ['a non-numeric override', { proposalId: PROPOSAL, arm: 'canary', overrides: { 'telemetry.latencyZ': '1.7' } }],
  ])('refuses %s', (_name, canary) => {
    expect(MentorCanarySchema.safeParse(canary).success).toBe(false);
  });

  it('never reaches the model context: the privacy contract has no canary field', () => {
    const contract = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../context/schema.ts'), 'utf8');
    expect(contract).not.toMatch(/canary|proposalId|overrides/i);
  });
});

describe('the orchestrator', () => {
  it('runs the canary arm and reports it at close', () => {
    const o = new TutorOrchestrator(
      { ...SESSION, canary: { proposalId: PROPOSAL, arm: 'canary', overrides: { 'telemetry.latencyZ': 1.7, 'selfExplanation.maxPerSession': 2 } } },
      1_000,
      silent,
    );
    expect(configsOf(o).telemetry.latencyZ).toBe(1.7);
    expect(configsOf(o).selfExplanation.maxPerSession).toBe(2);
    expect(o.closeRecord('completed').canary).toEqual({ proposalId: PROPOSAL, arm: 'canary' });
  });

  it('reports the control arm; reports nothing without a canary or after a refusal', () => {
    const control = new TutorOrchestrator({ ...SESSION, canary: { proposalId: PROPOSAL, arm: 'control', overrides: {} } }, 1_000, silent);
    expect(control.closeRecord('completed').canary).toEqual({ proposalId: PROPOSAL, arm: 'control' });
    expect(configsOf(control).telemetry).toEqual(TELEMETRY_DEFAULTS);
    expect('canary' in new TutorOrchestrator(SESSION, 1_000, silent).closeRecord('completed')).toBe(false);
    const refused = new TutorOrchestrator(
      { ...SESSION, canary: { proposalId: PROPOSAL, arm: 'canary', overrides: { 'session.softCapMinutes': 60 } } },
      1_000,
      silent,
    );
    expect('canary' in refused.closeRecord('completed')).toBe(false);
    expect(configsOf(refused).telemetry).toEqual(TELEMETRY_DEFAULTS);
  });

  it('a minor-posture session runs the defaults and reports no arm, whatever Core sent', () => {
    const minor = new TutorOrchestrator(
      { ...SESSION, isMinor: true, canary: { proposalId: PROPOSAL, arm: 'canary', overrides: { 'telemetry.latencyZ': 1.7 } } },
      1_000,
      silent,
    );
    expect(configsOf(minor).telemetry).toEqual(TELEMETRY_DEFAULTS);
    expect(configsOf(minor).refused).toMatch(/minor posture/);
    expect('canary' in minor.closeRecord('completed')).toBe(false);
  });
});
