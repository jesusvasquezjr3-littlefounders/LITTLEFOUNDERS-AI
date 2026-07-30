// EVERYTHING THIS SERVICE DOES WITHOUT A SINGLE VALID CREDENTIAL CONFIGURED.
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
// "No credential" has THREE shapes in the real world, and all three are pinned below:
// the variable is absent, the variable is BLANK (how every deploy target hands over a
// cleared value), and the variable is PRESENT BUT TRUNCATED (how an already-deployed
// service looks the day a length rule is introduced). Only the last one is a security
// question, and its answer is: treat it as unset, which is the fail-closed state.
//
// Nothing here opens a socket except the one test that spawns the CLI.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import request from 'supertest';

import { createApp, SERVICE, VERSION } from '../app.js';
import {
  ConfigError,
  DEFAULT_PORT,
  MIN_INTERNAL_KEY_LENGTH,
  getBootPort,
  getConfig,
  requireGenerationKeys,
  requireIllustrationKeys,
  requirePublishKeys,
  resetConfigCache,
} from '../env.js';

const execFileAsync = promisify(execFile);
const PACKAGE_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');

/** Every credential-ish variable the service knows about, plus the listener port. */
const MANAGED_ENV = [
  'PORT',
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
  for (const key of MANAGED_ENV) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  resetConfigCache();
});

afterEach(() => {
  for (const key of MANAGED_ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetConfigCache();
  vi.restoreAllMocks();
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

  it('rejects a WRONG full-length key with 401', async () => {
    process.env.INTERNAL_API_KEY = 'test-internal-key-not-a-real-credential';
    resetConfigCache();
    const res = await request(createApp())
      .get('/api/v1/anything')
      .set('x-internal-api-key', 'test-some-other-key-entirely-not-a-match');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('parses its whole config from an EMPTY environment — the dry run depends on this', () => {
    const config = getConfig();
    expect(config.PORT).toBe(DEFAULT_PORT);
    expect(config.DEEPSEEK_API_KEY).toBeUndefined();
    expect(config.QWEN_API_KEY).toBeUndefined();
    expect(config.PICTUREGEN_URL).toBeUndefined();
    expect(config.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    // The budget kill switches still have concrete values with no env at all.
    expect(config.ARCADE_MAX_TOKENS_PER_RUN).toBeGreaterThan(0);
    expect(config.ARCADE_MAX_USD_PER_RUN).toBeGreaterThan(0);
  });

  it('opens the listener on the default port', () => {
    expect(getBootPort()).toBe(DEFAULT_PORT);
  });
});

/*
 * REGRESSION — a cleared variable is not a crash.
 *
 * Railway, Docker and `--env-file` all deliver a cleared variable as "", never as an
 * absent key, and `.optional()` admits only `undefined`. So `PICTUREGEN_URL=` and
 * `PORT=` used to be hard ZodError parse failures while DELETING the same variables
 * was completely fine. Every assertion in this block threw before `readEnv()` existed.
 */
describe('the service with BLANK (empty-string) credentials — the Railway shape', () => {
  beforeEach(() => {
    for (const key of MANAGED_ENV) process.env[key] = '';
    // Whitespace-only is the same mistake with an invisible character in it.
    process.env.SUPABASE_URL = '   ';
    resetConfigCache();
  });

  it('parses the config, treating every blank value as unset', () => {
    const config = getConfig();
    expect(config.PORT).toBe(DEFAULT_PORT);
    expect(config.INTERNAL_API_KEY).toBeUndefined();
    expect(config.DEEPSEEK_API_KEY).toBeUndefined();
    expect(config.QWEN_API_KEY).toBeUndefined();
    expect(config.PICTUREGEN_URL).toBeUndefined();
    expect(config.PICTUREGEN_INTERNAL_KEY).toBeUndefined();
    expect(config.SUPABASE_URL).toBeUndefined();
    expect(config.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    // Defaults survive intact — a blank var must not zero out a budget cap.
    expect(config.ARCADE_CONCURRENCY).toBeGreaterThan(0);
    expect(config.DEEPSEEK_BASE_URL).toContain('deepseek');
  });

  it('answers GET /health', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('still FAILS CLOSED on /api/v1, including against a blank header', async () => {
    const app = createApp();
    expect((await request(app).get('/api/v1/anything')).status).toBe(401);
    const res = await request(app).get('/api/v1/anything').set('x-internal-api-key', '');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('opens the listener on the default port', () => {
    expect(getBootPort()).toBe(DEFAULT_PORT);
  });

  it('still refuses the paid stages by name', () => {
    expect(() => requireGenerationKeys()).toThrow(/DEEPSEEK_API_KEY.*QWEN_API_KEY/s);
    expect(() => requirePublishKeys()).toThrow(/SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY/s);
  });
});

/*
 * REGRESSION — the deployed-key problem (§1.14 liveness).
 *
 * gamegen is already running on Railway with an INTERNAL_API_KEY set before any length
 * rule existed. `z.string().min(16)` in the schema meant the next deploy would throw
 * inside getConfig() at index.ts import time: no listener, healthcheck refused,
 * container restarted, same throw, forever — the service simply disappears. The rule is
 * not dropped, it is relocated: a truncated key is downgraded to UNSET, which is
 * precisely the state in which the guard refuses everything.
 */
describe('a TRUNCATED INTERNAL_API_KEY (shorter than the minimum)', () => {
  const SHORT_KEY = 'test-short';

  beforeEach(() => {
    expect(SHORT_KEY.length).toBeLessThan(MIN_INTERNAL_KEY_LENGTH);
    process.env.INTERNAL_API_KEY = SHORT_KEY;
    resetConfigCache();
  });

  it('does not stop the config from parsing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => getConfig()).not.toThrow();
  });

  it('boots: the listener port resolves and /health answers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(getBootPort()).toBe(DEFAULT_PORT);
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('is downgraded to UNSET and logged loudly, naming the variable', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(getConfig().INTERNAL_API_KEY).toBeUndefined();
    expect(spy).toHaveBeenCalled();
    const logged = spy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('INTERNAL_API_KEY');
    // The value itself must never reach the logs.
    expect(logged).not.toContain(SHORT_KEY);
  });

  it('FAILS CLOSED: the truncated key does not authorize a request that presents it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(createApp()).get('/api/v1/anything').set('x-internal-api-key', SHORT_KEY);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid internal API key' } });
  });
});

describe('a genuinely INVALID value fails readably, never as a stack trace', () => {
  it('throws ConfigError naming every offending variable, not a raw ZodError', () => {
    process.env.PICTUREGEN_URL = 'definitely-not-a-url';
    process.env.PORT = 'four thousand and three';
    resetConfigCache();

    let caught: unknown;
    try {
      getConfig();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ConfigError);
    const error = caught as ConfigError;
    expect(error.name).toBe('ConfigError');
    expect([...error.variables].sort()).toEqual(['PICTUREGEN_URL', 'PORT']);
    expect(error.message).toContain('PICTUREGEN_URL');
    expect(error.message).toContain('PORT');
    // Operator-facing: says where to fix it, and never leaks the zod internals.
    expect(error.message).toContain('gamegen/.env');
    expect(error.message).not.toContain('ZodError');
    expect(error.message).not.toContain('"code":');
  });

  it('STILL boots — a broken config must not cost us /health (§1.14)', async () => {
    process.env.PICTUREGEN_URL = 'definitely-not-a-url';
    resetConfigCache();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Falls back to the real PORT when it is usable, so the healthcheck finds us.
    process.env.PORT = '4999';
    expect(getBootPort()).toBe(4999);
    expect(spy.mock.calls.map((call) => call.join(' ')).join('\n')).toContain('PICTUREGEN_URL');

    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('falls back to the default port when PORT itself is the broken variable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.PORT = 'not-a-port';
    resetConfigCache();
    expect(getBootPort()).toBe(DEFAULT_PORT);
  });
});

/*
 * REGRESSION — the CLI's own failure mode. A blank/invalid variable used to escape as
 * an unhandled ZodError from whichever provider read the config first, printing a stack
 * trace through src/env.ts that named no variable and suggested no fix, and doing it
 * even for `--dry-run` (the mode whose whole promise is that it needs nothing).
 */
describe('the CLI refuses bad configuration with an operator-facing message', () => {
  async function runCli(env: Record<string, string>): Promise<{ code: number; stderr: string; stdout: string }> {
    try {
      const { stdout, stderr } = await execFileAsync(
        path.join(PACKAGE_ROOT, 'node_modules', '.bin', 'tsx'),
        [path.join(PACKAGE_ROOT, 'src', 'cli.ts'), '--course', 'no-such-course', '--dry-run'],
        { cwd: PACKAGE_ROOT, env: { ...process.env, ...env } },
      );
      return { code: 0, stdout, stderr };
    } catch (err) {
      const failure = err as { code?: number; stdout?: string; stderr?: string };
      return { code: failure.code ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
    }
  }

  it('exits 1 naming the variable, with no stack trace and no ZodError', async () => {
    const { code, stderr } = await runCli({ PICTUREGEN_URL: 'definitely-not-a-url' });

    expect(code).toBe(1);
    expect(stderr).toContain('PICTUREGEN_URL');
    expect(stderr).toContain('gamegen/.env');
    expect(stderr).not.toContain('ZodError');
    // No stack frames: a line of the shape "    at somewhere (file:line)".
    expect(stderr).not.toMatch(/^\s+at .+/m);
  }, 60_000);
});

describe('the require*Keys gates are LAZY refusals, never import-time ones', () => {
  it('each names exactly the variables it needs, and only when called', () => {
    // Importing this module already happened at the top of the file without throwing —
    // that is half the assertion. The other half:
    expect(() => requireGenerationKeys()).toThrow(/DEEPSEEK_API_KEY.*QWEN_API_KEY/s);
    expect(() => requireIllustrationKeys()).toThrow(/PICTUREGEN_URL.*PICTUREGEN_INTERNAL_KEY/s);
    expect(() => requirePublishKeys()).toThrow(/SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY/s);
  });

  it('refuses a TRUNCATED outbound key too — the length rule moved here, it did not vanish', () => {
    process.env.DEEPSEEK_API_KEY = 'short';
    process.env.QWEN_API_KEY = 'test-qwen-key-placeholder';
    process.env.PICTUREGEN_URL = 'http://prism.test';
    process.env.PICTUREGEN_INTERNAL_KEY = 'test-tiny';
    resetConfigCache();

    // Parsing still succeeds: a bad outbound key is the CLI's problem, never the
    // HTTP service's — /health may not depend on it (§1.14).
    expect(() => getConfig()).not.toThrow();

    expect(() => requireGenerationKeys()).toThrow(/DEEPSEEK_API_KEY.*shorter than 8/s);
    expect(() => requireGenerationKeys()).toThrow(ConfigError);
    expect(() => requireIllustrationKeys()).toThrow(/PICTUREGEN_INTERNAL_KEY.*shorter than 16/s);
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
