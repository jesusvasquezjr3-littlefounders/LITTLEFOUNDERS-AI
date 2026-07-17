import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const KEY = process.env.INTERNAL_API_KEY as string;

// Synthetic ID text the mocked OCR "reads" — no real person.
const OCR_TEXT = `INSTITUTO NACIONAL ELECTORAL CREDENCIAL PARA VOTAR
NOMBRE GOMEZ HERNANDEZ MARIA FERNANDA
FECHA DE NACIMIENTO 14/02/1988 VIGENCIA 2032`;

const FIELDS = { givenNames: 'María Fernanda', surnames: 'Gómez Hernández', birthDate: '1988-02-14' };
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function post(app: ReturnType<typeof createApp>) {
  return request(app).post('/internal/v1/verifications/parent').set('x-internal-api-key', KEY);
}

function withFields(req: request.Test, fields: Record<string, string> = FIELDS) {
  for (const [k, v] of Object.entries(fields)) req.field(k, v);
  return req.attach('document', PNG_1PX, { filename: 'id.png', contentType: 'image/png' });
}

describe('POST /internal/v1/verifications/parent', () => {
  it('rejects a missing/invalid internal key', async () => {
    const res = await request(createApp({ recognize: async () => OCR_TEXT }))
      .post('/internal/v1/verifications/parent')
      .set('x-internal-api-key', 'wrong');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns a verified verdict when the document matches', async () => {
    const res = await withFields(post(createApp({ recognize: async () => OCR_TEXT })));
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.checks).toMatchObject({ nameMatch: true, birthDateMatch: true, notExpired: true });
  });

  it('returns an unverified verdict (200) on mismatch — verdicts are data, not errors', async () => {
    const res = await withFields(post(createApp({ recognize: async () => OCR_TEXT })), {
      ...FIELDS,
      surnames: 'López Ramírez',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(false);
    expect(res.body.data.checks.nameMatch).toBe(false);
  });

  it('never echoes OCR text or applicant data in the response', async () => {
    const res = await withFields(post(createApp({ recognize: async () => OCR_TEXT })));
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('GOMEZ');
    expect(raw).not.toContain('1988');
  });

  it('400s on a missing document image', async () => {
    const req = post(createApp({ recognize: async () => OCR_TEXT }));
    for (const [k, v] of Object.entries(FIELDS)) req.field(k, v);
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400s on a malformed birthDate', async () => {
    const res = await withFields(post(createApp({ recognize: async () => OCR_TEXT })), {
      ...FIELDS,
      birthDate: '14/02/1988',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422s when OCR itself fails, without detail', async () => {
    const res = await withFields(
      post(createApp({ recognize: async () => Promise.reject(new Error('SECRET-DETAIL')) })),
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DOCUMENT_UNREADABLE');
    expect(JSON.stringify(res.body)).not.toContain('SECRET-DETAIL');
  });
});
