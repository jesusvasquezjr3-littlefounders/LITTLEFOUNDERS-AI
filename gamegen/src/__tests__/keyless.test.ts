// EVERYTHING THIS SERVICE DOES WITHOUT A SINGLE CREDENTIAL CONFIGURED.
//
// Two independent invariants share this file because they share a precondition —
// `Env.parse({})` must succeed:
//
//  1. §1.14 LIVENESS: `GET /health` sits above every guard and every optional
//     dependency. A service that cannot answer its platform healthcheck is restarted
//     forever, so coupling health to a key turns a missing secret into an outage.
//  2. GAME_ENGINE.md §9: `--dry-run` requires NO API keys. That is only structurally
//     possible if config parsing never demands one and the `require*Keys()` gates are
//     LAZY — called right before money is spent, never at import time. The end-to-end
//     proof is `dry-run.test.ts`; this file pins the foundation it stands on.
//
// The suite deletes every credential from the environment on purpose. Nothing here
// opens a socket.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp, SERVICE, VERSION } from '../app.js';
import {
  getConfig,
  requireGenerationKeys,
  requireIllustrationKeys,
  requirePublishKeys,
  resetConfigCache,
} from '../env.js';

/** Every credential-ish variable the service knows about. */
const CREDENTIAL_ENV = [
  'INTERNAL_API_KEY',
  'DEEPSEEK_API_KEY',
  'QWEN_API_KEY',
  'PICTUREGEN_URL',
  'PICTUREGEN_INTERNAL_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of CREDENTIAL_ENV) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  resetConfigCache();
});

afterEach(() => {
  for (const key of CREDENTIAL_ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetConfigCache();
});

describe('the service with ZERO credentials configured', () => {
  it('answers GET /health with the ok envelope', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { service: SERVICE, version: VERSION, status: 'ok' },
      error: null,
    });
  });

  it('still answers /health after a request that the internal guard rejects', async () => {
    const app = createApp();
    await request(app).get('/api/v1/anything');
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('FAILS CLOSED on /api/v1 — no configured key can never make an absent header a match', async () => {
    const res = await request(createApp()).get('/api/v1/anything');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid internal API key' } });
  });

  it('rejects a NON-ASCII key header with 401, never a RangeError 500 (§1.14)', async () => {
    process.env.INTERNAL_API_KEY = 'test-internal-key-not-a-real-credential';
    resetConfigCache();
    // Same UTF-16 LENGTH as the expected key, more UTF-8 BYTES: a length pre-check in
    // front of timingSafeEqual would throw RangeError here and answer 500.
    const sameLengthNonAscii = 'é'.repeat('test-internal-key-not-a-real-credential'.length);
    const res = await request(createApp())
      .get('/api/v1/anything')
      .set('x-internal-api-key', sameLengthNonAscii);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('parses its whole config from an EMPTY environment — the dry run depends on this', () => {
    const config = getConfig();
    expect(config.PORT).toBe(4003);
    expect(config.DEEPSEEK_API_KEY).toBeUndefined();
    expect(config.QWEN_API_KEY).toBeUndefined();
    expect(config.PICTUREGEN_URL).toBeUndefined();
    expect(config.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    // The budget kill switches still have concrete values with no env at all.
    expect(config.ARCADE_MAX_TOKENS_PER_RUN).toBeGreaterThan(0);
    expect(config.ARCADE_MAX_USD_PER_RUN).toBeGreaterThan(0);
  });
});

describe('the require*Keys gates are LAZY refusals, never import-time ones', () => {
  it('each names exactly the variables it needs, and only when called', () => {
    // Importing this module already happened at the top of the file without throwing —
    // that is half the assertion. The other half:
    expect(() => requireGenerationKeys()).toThrow(/DEEPSEEK_API_KEY.*QWEN_API_KEY/s);
    expect(() => requireIllustrationKeys()).toThrow(/PICTUREGEN_URL.*PICTUREGEN_INTERNAL_KEY/s);
    expect(() => requirePublishKeys()).toThrow(/SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY/s);
  });

  it('passes once the keys are present', () => {
    // Placeholder credentials: each VALUE starts with `test-`, the exemption
    // agent/tools/check-secrets.sh recognizes (/AGENTS.md §1.14).
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key-placeholder';
    process.env.QWEN_API_KEY = 'test-qwen-key-placeholder';
    process.env.PICTUREGEN_URL = 'http://prism.test';
    process.env.PICTUREGEN_INTERNAL_KEY = 'test-prism-internal-key-placeholder';
    process.env.SUPABASE_URL = 'http://vault.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-placeholder';
    resetConfigCache();

    expect(() => requireGenerationKeys()).not.toThrow();
    expect(() => requireIllustrationKeys()).not.toThrow();
    expect(() => requirePublishKeys()).not.toThrow();
  });
});
