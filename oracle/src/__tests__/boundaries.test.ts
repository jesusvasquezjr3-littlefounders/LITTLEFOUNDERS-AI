import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

/*
 * Architectural invariants, asserted as tests.
 *
 * These are the rules that a reviewer would have to remember, and reviewers
 * forget. Each one below is a rule stated somewhere in /AGENTS.md or
 * /ORACLE.md that has no other enforcement.
 */

// fileURLToPath, never URL.pathname: on Windows the latter yields '/C:/...'
// and every fs call resolves against the wrong drive.
const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') sourceFiles(full, acc);
    } else if (entry.endsWith('.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('the voice provider stays behind its interface', () => {
  it('names the provider ONLY inside src/voice/', () => {
    // /AGENTS.md §1.2: Inworld is explicitly interim, to be replaced by
    // self-hosted speech. That migration is cheap only while nothing above the
    // transducer knows the provider's name.
    const offenders = sourceFiles(SRC)
      .filter((file) => !file.includes(`${join('src', 'voice')}`) && !file.includes(`${join('oracle', 'src', 'voice')}`))
      .filter((file) => /inworld/i.test(readFileSync(file, 'utf8')))
      // env.ts holds the configuration keys, which is the one place a provider
      // name legitimately appears outside the adapter.
      .filter((file) => !file.endsWith(`${join('src', 'env.ts')}`));

    expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
  });
});

describe('Oracle has no database access', () => {
  it('imports no database client anywhere', () => {
    // Every fact about a learner arrives through core/client.ts, already
    // scoped to one person. Oracle cannot read an unscoped row because it has
    // no connection to read it with (/ORACLE.md §3.1).
    const banned = /from\s+'(pg|postgres|@supabase\/supabase-js|duckdb|knex|drizzle-orm)'/;
    const offenders = sourceFiles(SRC).filter((file) => banned.test(readFileSync(file, 'utf8')));
    expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
  });
});

describe('the model context has exactly one door', () => {
  it('builds a model request only through the sealed context', () => {
    // Anything that SENDS to the pedagogical model must have gone through
    // sealContext first. Today orchestrator.ts is the only caller; this test
    // is what notices when a second one appears.
    //
    // Keyed on calling `complete(`, not on importing the module: routes and
    // health checks import `modelConfigured` to report whether a key exists,
    // which sends nothing anywhere and needs no context.
    const senders = sourceFiles(SRC).filter((file) => {
      const source = readFileSync(file, 'utf8');
      return source.includes("model/provider.js'") && source.includes('complete(');
    });
    // Guard against a vacuous pass. Without it, a typo in the match above
    // makes this test green by finding nothing — which is exactly how it
    // failed the first time it was written.
    expect(senders.length).toBeGreaterThan(0);

    // A file may seal a conversational context OR a generation brief — those
    // are genuinely different payloads with genuinely different schemas
    // (/ORACLE.md §4.1, §7.3). What it may NOT do is call the model having
    // sealed neither, and matching on the `seal` prefix keeps that true as
    // further payload kinds appear.
    const withoutSeal = senders.filter((file) => !/\bseal[A-Z]\w*\(/.test(readFileSync(file, 'utf8')));
    expect(withoutSeal.map((f) => f.replace(SRC, ''))).toEqual([]);
  });
});

describe('/health', () => {
  it('answers with the envelope and never depends on optional infrastructure', async () => {
    // No model key, no judge key, no voice provider, no Redis in this test —
    // and /health must still be 200. §1.14: a service that cannot serve its
    // healthcheck gets restarted, which fixes none of those.
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.error).toBeNull();
    expect(response.body.data.service).toBe('oracle');
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.components.model).toBe('down');
  });

  it('is reachable without the internal API key', async () => {
    await request(createApp()).get('/health').expect(200);
  });
});

describe('the internal API', () => {
  it('rejects a request with no internal key', async () => {
    const response = await request(createApp()).get('/api/v1/tutor/status');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a wrong key without throwing on multi-byte characters', async () => {
    // §1.14 again: a length pre-check before timingSafeEqual would make this a
    // 500 instead of a 401, because String.length counts UTF-16 units and
    // Buffer.from yields UTF-8 bytes.
    const response = await request(createApp())
      .get('/api/v1/tutor/status')
      .set('x-internal-api-key', 'ñ'.repeat(28));
    expect(response.status).toBe(401);
  });

  it('accepts the correct key', async () => {
    const response = await request(createApp(() => 3))
      .get('/api/v1/tutor/status')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string);
    expect(response.status).toBe(200);
    expect(response.body.data.liveSessions).toBe(3);
  });

  it('reports how many fixed lines this instance can speak for free', async () => {
    // A missing pre-generated manifest is otherwise invisible: every line is
    // still spoken and every one of them is billed again (/ORACLE.md §15.1).
    const response = await request(createApp())
      .get('/api/v1/tutor/status')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string);
    expect(typeof response.body.data.pregeneratedLines).toBe('number');
    expect(response.body.data.speechCacheScope).toBe('scripted');
  });

  it('preflight refuses to start a session with no model configured', async () => {
    const response = await request(createApp())
      .post('/api/v1/tutor/preflight')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send({ isMinor: true, wantsVoice: true });

    expect(response.status).toBe(200);
    expect(response.body.data.canStart).toBe(false);
    expect(response.body.data.blockedBy).toBe('MODEL_UNAVAILABLE');
  });

  it('preflight validates its body', async () => {
    const response = await request(createApp())
      .post('/api/v1/tutor/preflight')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send({ isMinor: 'yes' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns the envelope on an unknown route', async () => {
    const response = await request(createApp()).get('/api/v1/nope');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      data: null,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });
});
