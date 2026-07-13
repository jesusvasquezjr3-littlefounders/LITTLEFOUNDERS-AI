import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('path traversal defenses', () => {
  it('rejects a traversal payload in the hash/ext segment (400 or 404, never 200)', async () => {
    const app = createApp();
    const attempts = [
      '/files/lesson-audio/..%2f..%2f..%2fetc%2fpasswd',
      '/files/lesson-audio/....//....//etc/passwd.mp3',
      '/files/lesson-audio/%2e%2e%2f%2e%2e%2fpackage.json',
    ];
    for (const path of attempts) {
      const res = await request(app).get(path);
      expect([400, 404]).toContain(res.status);
      expect(res.body.data).toBeNull();
    }
  });

  it('rejects a traversal payload in the bucket segment', async () => {
    const app = createApp();
    const res = await request(app).get(`/files/${encodeURIComponent('..')}/${'a'.repeat(64)}.mp3`);
    expect([400, 404]).toContain(res.status);
    expect(res.body.data).toBeNull();
  });

  it('never resolves outside FILEBASE_ROOT regardless of what slips through routing', async () => {
    const app = createApp();
    // Even a technically route-matching but bogus hash must 400/404, not
    // touch anything outside the content-addressed tree.
    const res = await request(app).get('/files/lesson-audio/not-a-real-hash.mp3');
    expect([400, 404]).toContain(res.status);
  });
});
