import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { pickPack, tierForBirthDate } from '../routes/tutor.js';

/*
 * /api/v1/tutor — Money Moments. The safety property is structural (packs
 * are pre-gated, published-only, served from Vault), so the tests pin the
 * resolution logic: tier from age, locale from profile, published-only
 * visibility, and the fallback ladder.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111';

const PACK = {
  terms: [{ term: 'mesada', kid_definition: 'Tu dinero semanal.' }],
  phrases: [{ say_md: 'Aparto primero.', why_md: 'Así la meta avanza.' }],
  quick_check: { question_md: '¿Qué haces primero?', options: [] },
};

let db: FakeDb;
let token: string;

beforeEach(() => {
  token = mintToken({ sub: USER_ID });
  db = {
    user_roles: [{ user_id: USER_ID, role: 'universal' }],
    profiles: [{ user_id: USER_ID, display_name: 'Kid', username: 'kid', locale: 'es-MX', theme: 'system', cover: {}, birth_date: '2018-01-15', created_at: 'x' }],
    tutor_situations: [
      { id: 'mesada', icon: 'savings', title: { 'es-MX': 'Día de mesada' }, description: { 'es-MX': '...' }, tiers: ['tier1', 'tier2'], position: 1 },
      { id: 'tianguis', icon: 'shopping_basket', title: { 'es-MX': 'Tianguis' }, description: { 'es-MX': '...' }, tiers: ['tier2'], position: 2 },
    ],
    tutor_packs: [
      { situation_id: 'mesada', tier: 'tier2', locale: 'es-MX', status: 'published', pack: PACK },
      { situation_id: 'tianguis', tier: 'tier2', locale: 'es-MX', status: 'review', pack: PACK },
    ],
  };
  vi.stubGlobal('fetch', createFakeFetch(db));
});

afterEach(() => vi.unstubAllGlobals());

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

describe('tierForBirthDate', () => {
  it.each([
    ['2019-06-01', 'tier1'], // ~7
    ['2017-06-01', 'tier2'], // ~9
    ['2014-06-01', 'tier3'], // ~12
    [null, 'tier2'],
  ])('%s → %s', (birth, tier) => {
    expect(tierForBirthDate(birth as string | null, new Date('2026-07-25'))).toBe(tier);
  });
});

describe('pickPack fallback ladder', () => {
  const packs = [
    { tier: 'tier2', locale: 'en-US' },
    { tier: 'tier2', locale: 'es-MX' },
    { tier: 'tier1', locale: 'pt-BR' },
  ];
  it('exact tier+locale first', () => {
    expect(pickPack(packs, 'tier2', 'en-US')).toEqual({ tier: 'tier2', locale: 'en-US' });
  });
  it('same tier in es-MX next', () => {
    expect(pickPack(packs, 'tier2', 'pt-BR')).toEqual({ tier: 'tier2', locale: 'es-MX' });
  });
  it('any tier in the locale next', () => {
    expect(pickPack([{ tier: 'tier1', locale: 'pt-BR' }], 'tier3', 'pt-BR')).toEqual({ tier: 'tier1', locale: 'pt-BR' });
  });
});

describe('GET /api/v1/tutor/situations', () => {
  it('lists curated situations with availability from PUBLISHED packs only', async () => {
    const res = await auth(request(createApp()).get('/api/v1/tutor/situations'));
    expect(res.status).toBe(200);
    expect(res.body.data.tier).toBe('tier2'); // born 2018 → 8 años
    expect(res.body.data.situations).toEqual([
      expect.objectContaining({ id: 'mesada', available: true }),
      expect.objectContaining({ id: 'tianguis', available: false }), // its pack is review, not published
    ]);
  });

  it('401s without a session', async () => {
    const res = await request(createApp()).get('/api/v1/tutor/situations');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/tutor/situations/:id/pack', () => {
  it('serves the published pack resolved to the caller tier+locale', async () => {
    const res = await auth(request(createApp()).get('/api/v1/tutor/situations/mesada/pack'));
    expect(res.status).toBe(200);
    expect(res.body.data.tier).toBe('tier2');
    expect(res.body.data.locale).toBe('es-MX');
    expect(res.body.data.pack.terms[0].term).toBe('mesada');
  });

  it('404s when only unpublished packs exist — review content NEVER reaches a kid', async () => {
    const res = await auth(request(createApp()).get('/api/v1/tutor/situations/tianguis/pack'));
    expect(res.status).toBe(404);
  });

  it('400s on a malformed situation id', async () => {
    const res = await auth(request(createApp()).get('/api/v1/tutor/situations/NOT_A_SLUG!/pack'));
    expect(res.status).toBe(400);
  });
});
