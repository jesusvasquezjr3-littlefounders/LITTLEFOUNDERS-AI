import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { fittedNameSize, layoutLabel, measure, wrapLabel } from '../lib/badge.js';
import { BADGE_DESIGN } from '../lib/badgeDesign.generated.js';
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

const VALID = { kind: 'streak', label: '7-day streak', firstName: 'Sofía', locale: 'en-US', kicker: 'Learning streak' };

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
    const es = await render(app, { ...VALID, locale: 'es-MX', kicker: 'Racha de aprendizaje', label: 'Racha de 7 días' });
    expect((en.body as Buffer).equals(es.body as Buffer)).toBe(false);
  });

  it('refuses any field beyond kind, label, first name, locale and kicker (F.6 minimization)', async () => {
    const app = createApp();
    for (const extra of [{ ageBand: '6-8' }, { surname: 'García' }, { photoUrl: 'https://x.test/p.png' }, { bucket: 'badges' }]) {
      const res = await request(app).post('/api/v1/badges/render').set('x-internal-api-key', KEY()).send({ ...VALID, ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('refuses an unknown kind, an over-long name and a missing locale', async () => {
    const app = createApp();
    for (const body of [
      { ...VALID, kind: 'not-a-kind' },
      { ...VALID, firstName: 'x'.repeat(41) },
      { kind: 'streak', label: 'x', firstName: 'x' },
      { ...VALID, label: 'x'.repeat(81) },
      // 06 section 5.7: calm copy, so a kicker with an exclamation mark is refused.
      { ...VALID, kicker: 'Streak!' },
      { ...VALID, kicker: '¡Racha' },
    ]) {
      const res = await request(app).post('/api/v1/badges/render').set('x-internal-api-key', KEY()).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('still renders without a kicker (Depot deploys before the Core that sends one)', async () => {
    const withoutKicker: Partial<typeof VALID> = { ...VALID };
    delete withoutKicker.kicker;
    const res = await render(createApp(), withoutKicker);
    expect(res.status).toBe(200);
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

describe('label layout (02 D1: the image is the whole artifact, so nothing is clipped or cut)', () => {
  it('keeps short labels on one line and wraps long ones at word boundaries, by measured width', () => {
    expect(wrapLabel('7-day streak')).toEqual(['7-day streak']);
    const text = 'Saved 50 coins for "A new bicycle for the summer holidays at the lake"';
    const lines = wrapLabel(text);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => measure(BADGE_DESIGN.faces.body, line, 52) <= 920)).toBe(true);
    expect(lines.join(' ')).toBe(text);
  });

  it('hard-splits an unbroken word and never drops a character or adds an ellipsis', () => {
    const word = 'x'.repeat(80);
    const lines = wrapLabel(word);
    expect(lines.join('')).toBe(word);
    expect(lines.every((line) => measure(BADGE_DESIGN.faces.body, line, 52) <= 920)).toBe(true);
    const many = 'word '.repeat(40).trim();
    const layout = layoutLabel(many);
    expect(layout.lines.join(' ')).toBe(many);
    expect(layout.lines.some((line) => line.includes('…'))).toBe(false);
  });

  it('shrinks the label step-wise only when it needs more lines than the area holds', () => {
    expect(layoutLabel('7-day streak').size).toBe(52);
    const long = Array.from({ length: 16 }, () => 'Wwwwwwwwwwwwwwww').join(' ');
    const layout = layoutLabel(long);
    expect(layout.size).toBeLessThan(52);
    expect(layout.lines.join(' ')).toBe(long);
  });

  it('shrinks a long first name to fit one line', () => {
    expect(fittedNameSize('Ana')).toBe(104);
    const size = fittedNameSize('Maximilianoooooooooooooooooooooooooooooo'.slice(0, 40));
    expect(size).toBeLessThan(104);
    expect(size).toBeGreaterThanOrEqual(48);
  });

  it('renders the longest accepted name and label', async () => {
    const res = await render(createApp(), { ...VALID, firstName: 'Maximilianoooooooooooooooooooooooooooooo'.slice(0, 40), label: 'y'.repeat(80) });
    expect(res.status).toBe(200);
  });
});
