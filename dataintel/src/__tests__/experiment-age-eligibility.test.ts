import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../env.js';
import { ageWithinBounds, POLICY_MIN_AGE } from '../services/experiments.js';

/*
 * H.7 under OD-23 and OD-26. Every experiment is adults-only (18+) unless an
 * owner decision opened it; the one exception, od26_c17, is the C.17 Mentor
 * dialogue experiment, which may go down to 10 (teens with their own opt-in,
 * tweens with guardian consent, both enforced by Core) and never to 6-9. An
 * unknown age is never eligible, bounded or not.
 */

describe('ageWithinBounds (H.7, OD-23/OD-26)', () => {
  it('an experiment with no bounds is adults only, not open to everyone', () => {
    expect(ageWithinBounds(18, null, null)).toBe(true);
    expect(ageWithinBounds(40, null, null)).toBe(true);
    expect(ageWithinBounds(17, null, null)).toBe(false);
    expect(ageWithinBounds(9, null, null)).toBe(false);
  });

  it('an unknown age is never eligible, under any policy or bound', () => {
    expect(ageWithinBounds(null, null, null)).toBe(false);
    expect(ageWithinBounds(undefined, null, null)).toBe(false);
    expect(ageWithinBounds(null, 10, 17, 'od26_c17')).toBe(false);
    expect(ageWithinBounds(Number.NaN, null, null)).toBe(false);
  });

  it('a declared bound can raise the floor but never lower it', () => {
    expect(ageWithinBounds(20, 21, null)).toBe(false);
    expect(ageWithinBounds(21, 21, null)).toBe(true);
    // A legacy row declaring minAge 6 under adults_only still admits 18+ only.
    expect(ageWithinBounds(9, 6, 12)).toBe(false);
    expect(ageWithinBounds(12, 6, null)).toBe(false);
  });

  it('od26_c17 admits 10-17 inside its bounds and never 6-9', () => {
    expect(POLICY_MIN_AGE.od26_c17).toBe(10);
    expect(ageWithinBounds(10, null, 17, 'od26_c17')).toBe(true);
    expect(ageWithinBounds(13, 13, 17, 'od26_c17')).toBe(true);
    expect(ageWithinBounds(9, null, 17, 'od26_c17')).toBe(false);
    expect(ageWithinBounds(6, 6, 17, 'od26_c17')).toBe(false);
    expect(ageWithinBounds(18, null, 17, 'od26_c17')).toBe(false);
  });
});

const KEY = getConfig().INTERNAL_API_KEY;
const post = (path: string, body: unknown) => request(createApp()).post(`/api/v1/intel${path}`).set('x-internal-api-key', KEY).send(body);
const BASE = { name: 'Eligibility probe', metric: 'dau', variantA: 'Control', variantB: 'Variant' };

describe('POST /experiments refuses every population outside OD-23/OD-26', () => {
  it.each([
    ['a minor lower bound on the default policy', { minAge: 13 }],
    ['a minor lower bound declared adults_only', { minAge: 10, eligibilityPolicy: 'adults_only' }],
    ['an adults_only upper bound under 18', { maxAge: 17 }],
    ['od26_c17 reaching ages 6-9', { minAge: 6, surface: 'tutor', eligibilityPolicy: 'od26_c17' }],
    ['od26_c17 outside the Mentor surface', { minAge: 13, surface: 'learn', eligibilityPolicy: 'od26_c17' }],
    ['an unknown policy', { eligibilityPolicy: 'everyone' }],
    ['an undeclared field', { allowMinors: true }],
  ])('refuses %s with 400', async (_label, extra) => {
    const res = await post('/experiments', { ...BASE, ...extra });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates an adults_only experiment by default', async () => {
    const res = await post('/experiments', BASE);
    expect(res.status).toBe(201);
    expect(res.body.data.eligibilityPolicy).toBe('adults_only');
  });

  it('creates the C.17 exception only as od26_c17 on the tutor surface, 10 and over', async () => {
    const res = await post('/experiments', { ...BASE, surface: 'tutor', minAge: 13, maxAge: 17, eligibilityPolicy: 'od26_c17' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ eligibilityPolicy: 'od26_c17', minAge: 13, maxAge: 17 });
  });
});

describe('runtime assignment applies the adults-only default (the warehouse boundary)', () => {
  it('never assigns a minor or an unknown age to an unbounded running experiment; assigns an adult', async () => {
    const target = `h7-${Date.now().toString(36)}`;
    const created = await post('/experiments', { ...BASE, surface: 'profile', target });
    expect(created.status).toBe(201);
    const started = await post(`/experiments/${created.body.data.id}/start`, {});
    expect(started.status).toBe(200);
    const assign = (age: number | null) => post('/runtime/experiments/assignments', {
      userId: '11111111-1111-4111-8111-111111111111', surface: 'profile', target, age,
    });
    for (const age of [9, 12, 17, null]) {
      const res = await assign(age);
      expect(res.status, `age ${age}`).toBe(200);
      expect(res.body.data.assignments, `age ${age}`).toEqual([]);
    }
    const adult = await assign(30);
    expect(adult.status).toBe(200);
    expect(adult.body.data.assignments).toHaveLength(1);
    expect(adult.body.data.assignments[0].experimentId).toBe(created.body.data.id);
  });
});
