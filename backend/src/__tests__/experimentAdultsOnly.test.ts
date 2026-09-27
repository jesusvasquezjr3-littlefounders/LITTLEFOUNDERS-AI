import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * OD-23 / OD-26 (owner review M-12): every experiment except C.17 is adults
 * only, and C.17's exposure is recorded by Core when the Mentor session
 * starts. The generic exposure route therefore records nothing for anyone but
 * a self-managed adult whose analytics rule allows it, whatever consent a
 * minor holds. Each refused population is attacked with a direct request.
 */

const USER = '33333333-3333-4333-8333-333333333333';
const EXP = '44444444-4444-4444-8444-444444444444';
const route = '/api/v1/learn/experiments/exposure';
const body = { experiment_id: EXP, surface: 'learn', target: 'learn.home-card' };

interface Population {
  band: 'adult' | '13_to_17' | 'under_13';
  roles?: readonly string[];
  origin?: boolean;
  guardianConsent?: boolean;
  teenOptIn?: boolean;
  birthMonth?: string;
}

function fixture(p: Population) {
  const exposures: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/intel/runtime/experiments/exposure')) {
      exposures.push(JSON.parse(String(init?.body ?? '{}')));
      return Promise.resolve(jsonResponse(200, { data: { assignment: { experimentId: EXP, variant: 'B', surface: 'learn', target: 'learn.home-card' } }, error: null }));
    }
    if (url.includes('/rpc/promote_age_declaration')) return Promise.resolve(jsonResponse(200, 'adult'));
    if (url.includes('/account_age_declarations?')) {
      return Promise.resolve(jsonResponse(200, [{ declared_age_band: p.band, ...(p.birthMonth ? { declared_birth_month: p.birthMonth } : {}) }]));
    }
    if (url.includes('/account_safety_origins?')) return Promise.resolve(jsonResponse(200, p.origin ? [{ under13_origin: true }] : []));
    if (url.includes('/user_roles?')) return Promise.resolve(jsonResponse(200, (p.roles ?? ['universal']).map((role) => ({ role }))));
    if (url.includes('/analytics_consents?')) {
      return Promise.resolve(jsonResponse(200, p.guardianConsent ? [{ kid_user_id: USER, granted_at: '2026-09-01T00:00:00Z', revoked_at: null }] : []));
    }
    if (url.includes('/teen_analytics_preferences?')) {
      return Promise.resolve(jsonResponse(200, p.teenOptIn === undefined ? [] : [{ enabled: p.teenOptIn, disclosure_version: 1 }]));
    }
    return Promise.resolve(jsonResponse(200, []));
  }));
  return exposures;
}

const send = (payload: object = body) =>
  request(createApp()).post(route).set('Authorization', `Bearer ${mintToken({ sub: USER })}`).send(payload);

afterEach(() => vi.unstubAllGlobals());

describe('generic experiment exposure is adults only (OD-23, OD-26)', () => {
  it('records the exposure for a self-managed adult', async () => {
    const exposures = fixture({ band: 'adult' });
    const res = await send();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ recorded: true, experimentId: EXP, variant: 'B' });
    expect(exposures).toHaveLength(1);
  });

  it.each<[string, Population]>([
    ['a teen with their own analytics opt-in', { band: '13_to_17', teenOptIn: true }],
    ['a teen without an opt-in', { band: '13_to_17' }],
    ['a parent-created tween with guardian analytics consent', { band: 'under_13', roles: ['kid'], guardianConsent: true }],
    ['a parent-created young child with guardian analytics consent', { band: 'under_13', roles: ['kid', 'universal'], guardianConsent: true }],
    ['a kid-role account whose declared band says adult, even with consent', { band: 'adult', roles: ['kid'], guardianConsent: true }],
    ['an account of under-13 origin', { band: 'adult', origin: true }],
    ['an adult by birth month who said no as a teen', { band: '13_to_17', birthMonth: '2000-01-01', teenOptIn: false }],
  ])('records nothing for %s', async (_label, population) => {
    const exposures = fixture(population);
    const res = await send();
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ recorded: false });
    expect(exposures).toEqual([]);
  });

  it('refuses a malformed body before deciding anything', async () => {
    const exposures = fixture({ band: 'adult' });
    expect((await send({ ...body, experiment_id: 'nope' })).status).toBe(400);
    expect(exposures).toEqual([]);
  });

  it('requires authentication', async () => {
    fixture({ band: 'adult' });
    expect((await request(createApp()).post(route).send(body)).status).toBe(401);
  });
});
