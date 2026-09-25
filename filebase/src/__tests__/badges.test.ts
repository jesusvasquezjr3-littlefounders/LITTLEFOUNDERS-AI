import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { wrapLabel } from '../lib/badge.js';
import { KEY } from './helpers.js';

/*
 * OD-20 / F.1: achievement images are rendered and returned, never stored.
 * The invariants under test: the render path returns real PNG bytes with
 * no-store headers and leaves NOTHING under FILEBASE_ROOT; the retired
 * compose-and-store path refuses and writes nothing; and the renderer's
 * input is minimized (F.6) — an age band, surname or any extra field is
 * refused, not ignored.
 */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function binary(res: unknown, callback: (err: Error | null, body: Buffer) => void) {
  const stream = res as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
}

function render(app: ReturnType<typeof createApp>, body: Record<string, unknown>) {
  return request(app).post('/api/v1/badges/render').set('x-internal-api-key', KEY()).buffer(true).parse(binary).send(body);
}

function storedEntries(): string[] {
  const root = process.env.FILEBASE_ROOT as string;
  try {
    return readdirSync(root, { recursive: true }).map(String);
  } catch {
    return [];
  }
}

const VALID = { kind: 'streak', label: '7-day streak', firstName: 'Sofía', locale: 'en-US' };

describe('POST /api/v1/badges/render', () => {
  it('rejects a missing internal API key', async () => {
    const res = await request(createApp()).post('/api/v1/badges/render').send(VALID);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns PNG bytes with no-store headers and stores nothing', async () => {
    const before = storedEntries();
    const res = await render(createApp(), VALID);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    const body = res.body as Buffer;
    expect(body.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(body.byteLength).toBe(Number(res.headers['content-length']));
    expect(storedEntries()).toEqual(before);
  });

  it('renders every kind in every locale, deterministically', async () => {
    const app = createApp();
    for (const locale of ['en-US', 'es-MX', 'pt-BR']) {
      for (const kind of ['course_badge', 'streak', 'goal_reached']) {
        const a = await render(app, { ...VALID, kind, locale });
        const b = await render(app, { ...VALID, kind, locale });
        expect(a.status, `${kind}/${locale}`).toBe(200);
        expect((a.body as Buffer).equals(b.body as Buffer), `${kind}/${locale}`).toBe(true);
      }
    }
    const en = await render(app, VALID);
    const es = await render(app, { ...VALID, locale: 'es-MX' });
    expect((en.body as Buffer).equals(es.body as Buffer)).toBe(false);
  });

  it('refuses any field beyond kind, label, first name and locale (F.6 minimization)', async () => {
    const app = createApp();
    for (const extra of [{ ageBand: '6-8' }, { surname: 'García' }, { photoUrl: 'https://x.test/p.png' }, { bucket: 'badges' }]) {
      const res = await request(app).post('/api/v1/badges/render').set('x-internal-api-key', KEY()).send({ ...VALID, ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('refuses an unknown kind, an over-long name and a missing locale', async () => {
    const app = createApp();
    for (const body of [{ ...VALID, kind: 'not-a-kind' }, { ...VALID, firstName: 'x'.repeat(41) }, { kind: 'streak', label: 'x', firstName: 'x' }]) {
      const res = await request(app).post('/api/v1/badges/render').set('x-internal-api-key', KEY()).send(body);
      expect(res.status).toBe(400);
    }
  });

  it('XML-escapes a name that could break the SVG document', async () => {
    const res = await render(createApp(), { ...VALID, firstName: '<script>&"\'' });
    expect(res.status).toBe(200);
    expect((res.body as Buffer).subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });
});

describe('POST /api/v1/badges (retired compose-and-store)', () => {
  it('still requires the internal API key', async () => {
    const res = await request(createApp()).post('/api/v1/badges').send({ bucket: 'badges', ...VALID });
    expect(res.status).toBe(401);
  });

  it('answers 410 and writes no public object', async () => {
    const before = storedEntries();
    const res = await request(createApp())
      .post('/api/v1/badges')
      .set('x-internal-api-key', KEY())
      .send({ bucket: 'badges', kind: 'streak', label: '7-day streak', firstName: 'Sofía' });
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('GONE');
    expect(storedEntries()).toEqual(before);
  });
});

describe('wrapLabel (the image is the whole artifact, so nothing may clip)', () => {
  it('keeps short labels on one line and wraps long ones at word boundaries', () => {
    expect(wrapLabel('7-day streak')).toEqual(['7-day streak']);
    const lines = wrapLabel('Saved 50 coins for "A new bicycle for the summer holidays"');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => [...line].length <= 30)).toBe(true);
    expect(lines.join(' ')).toBe('Saved 50 coins for "A new bicycle for the summer holidays"');
  });

  it('hard-splits an unbroken word and caps an 80-char label at four lines', () => {
    expect(wrapLabel('x'.repeat(80)).every((line) => [...line].length <= 30)).toBe(true);
    const capped = wrapLabel('word '.repeat(40).trim());
    expect(capped.length).toBeLessThanOrEqual(4);
  });

  it('renders the longest accepted name and label', async () => {
    const res = await render(createApp(), { ...VALID, firstName: 'Maximilianoooooooooooooooooooooooooooooo'.slice(0, 40), label: 'y'.repeat(80) });
    expect(res.status).toBe(200);
  });
});

