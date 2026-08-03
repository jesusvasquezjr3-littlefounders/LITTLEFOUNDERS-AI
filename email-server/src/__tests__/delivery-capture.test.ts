import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetEmailLogForTests } from '../services/emailLog.js';

const KEY = 'test-internal-key-0123456789';

beforeAll(() => {
  process.env.INTERNAL_API_KEY = KEY;
});

beforeEach(() => {
  resetEmailLogForTests();
});

const post = (body: unknown) =>
  request(createApp()).post('/api/v1/logs').set('x-internal-api-key', KEY).send(body);

/*
 * POST /api/v1/logs is how GoTrue's auth mail reaches the admin console. It
 * arrives at Haraka over SMTP and never touches POST /send, so without this
 * path /admin/emails renders empty no matter how much mail SES delivers.
 */
describe('POST /api/v1/logs — SMTP delivery capture', () => {
  it('records a relayed message and makes it visible in the history', async () => {
    const app = createApp();
    const rec = await request(app)
      .post('/api/v1/logs')
      .set('x-internal-api-key', KEY)
      .send({ messageId: 'abc@littlefounders.ai', to: 'parent@example.com', subject: 'Confirma tu correo' });
    expect(rec.status).toBe(202);
    expect(rec.body.error).toBeNull();
    expect(rec.body.data.recorded).toBe(true);

    const list = await request(app).get('/api/v1/logs').set('x-internal-api-key', KEY);
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(1);
    const entry = list.body.data.entries[0];
    expect(entry.to).toBe('parent@example.com');
    expect(entry.subject).toBe('Confirma tu correo');
    // messageId is the SES-correlatable identity and must survive the round trip.
    expect(entry.messageId).toBe('abc@littlefounders.ai');
    // Defaults that mark this as SMTP-captured auth mail.
    expect(entry.status).toBe('relayed');
    expect(entry.templateType).toBe('auth');
  });

  it('counts captured mail in the summary', async () => {
    const app = createApp();
    await request(app).post('/api/v1/logs').set('x-internal-api-key', KEY)
      .send({ messageId: 'm1', to: 'a@example.com', subject: 'Reset' });
    await request(app).post('/api/v1/logs').set('x-internal-api-key', KEY)
      .send({ messageId: 'm2', to: 'b@example.com', subject: 'Reset' });

    const res = await request(app).get('/api/v1/logs/summary').set('x-internal-api-key', KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.statuses.relayed).toBe(2);
    expect(res.body.data.templates.auth).toBe(2);
  });

  it('rejects a body with no messageId using the envelope', async () => {
    const res = await post({ to: 'a@example.com', subject: 'x' });
    expect(res.status).toBe(400);
    expect(res.type).toBe('application/json');
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-uuid userId rather than silently dropping the row later', async () => {
    const res = await post({ messageId: 'm', to: 'a@example.com', subject: 'x', userId: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires the internal API key', async () => {
    const res = await request(createApp())
      .post('/api/v1/logs')
      .send({ messageId: 'm', to: 'a@example.com', subject: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('accepts a subject that is empty (SMTP allows it)', async () => {
    const res = await post({ messageId: 'm', to: 'a@example.com' });
    expect(res.status).toBe(202);
  });
});

/*
 * The Haraka plugin runs in Haraka's CommonJS runtime and is excluded from our
 * linter/type-checker, so its one piece of real logic — RFC 2047 subject
 * decoding — is covered here. GoTrue subjects are trilingual and accented, so
 * they arrive encoded; without decoding, /admin/emails would show
 * "=?UTF-8?B?..." instead of the subject line.
 */
describe('log_delivery plugin — RFC 2047 subject decoding', () => {
  /*
   * The package is "type": "module", so Node's own resolver would reject these
   * CommonJS plugins — but Haraka never uses Node's resolver: it reads the file
   * and evaluates it against an injected module/exports/require, which is why
   * relay_internal.js works in production. Load it the same way so the test
   * exercises the file exactly as the engine does.
   */
  function loadHarakaPlugin(file: string): Record<string, unknown> {
    const module = { exports: {} as Record<string, unknown> };
    vm.runInNewContext(
      readFileSync(file, 'utf8'),
      {
        module,
        exports: module.exports,
        require: createRequire(import.meta.url),
        Buffer,
        console,
        process,
        fetch,
        AbortSignal,
      },
      { filename: file },
    );
    return module.exports;
  }

  const plugin = loadHarakaPlugin(path.resolve(import.meta.dirname, '../../haraka/plugins/log_delivery.js'));
  const decode = plugin._decodeWords as (raw: string) => string;

  it('decodes base64 encoded words', () => {
    // "Confirma tu correo" in UTF-8 base64
    const encoded = `=?UTF-8?B?${Buffer.from('Confirma tu correo', 'utf8').toString('base64')}?=`;
    expect(decode(encoded)).toBe('Confirma tu correo');
  });

  it('decodes quoted-printable encoded words including underscore-as-space', () => {
    expect(decode('=?UTF-8?Q?Redefinir_sua_senha?=')).toBe('Redefinir sua senha');
  });

  it('decodes accented quoted-printable bytes', () => {
    // "Acción" — ó is C3 B3 in UTF-8
    expect(decode('=?UTF-8?Q?Acci=C3=B3n?=')).toBe('Acción');
  });

  it('leaves a plain ASCII subject untouched', () => {
    expect(decode('Welcome to LittleFounders')).toBe('Welcome to LittleFounders');
  });

  it('returns the raw token when the encoding is unintelligible', () => {
    const broken = '=?UTF-8?X?whatever?=';
    expect(decode(broken)).toBe(broken);
  });
});
