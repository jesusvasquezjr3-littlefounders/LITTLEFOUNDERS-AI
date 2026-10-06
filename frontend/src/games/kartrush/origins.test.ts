import { describe, expect, it } from 'vitest';
import { acceptGameUrl, KARTRUSH_ALLOWED_ORIGINS } from './origins';

describe('the game origin allow-list', () => {
  it('is exactly the five origins the contract names', () => {
    expect([...KARTRUSH_ALLOWED_ORIGINS].sort()).toEqual([
      'http://127.0.0.1:4010', 'http://localhost:4010', 'http://localhost:5174',
      'https://game-b2c.littlefounders.ai', 'https://kartrush-production.up.railway.app',
    ]);
  });

  it.each([
    'https://kartrush-production.up.railway.app/',
    'https://kartrush-production.up.railway.app/play?embed=1&build=3',
    'https://game-b2c.littlefounders.ai/?embed=1',
    'http://localhost:4010/?embed=1',
    'http://127.0.0.1:4010/index.html',
    'http://localhost:5174/',
    'HTTPS://KARTRUSH-PRODUCTION.UP.RAILWAY.APP/x',
  ])('accepts %s', (url) => {
    const accepted = acceptGameUrl(url);
    expect(accepted).not.toBeNull();
    expect(KARTRUSH_ALLOWED_ORIGINS).toContain(accepted!.origin);
  });

  it.each([
    ['another host', 'https://evil.example/?embed=1'],
    ['a lookalike subdomain', 'https://kartrush-production.up.railway.app.evil.example/'],
    ['a lookalike prefix', 'https://evil-kartrush-production.up.railway.app/'],
    ['userinfo that hides the host', 'https://kartrush-production.up.railway.app@evil.example/'],
    ['credentials on an allowed host', 'https://user:pass@game-b2c.littlefounders.ai/'],
    ['the wrong scheme for a production host', 'http://game-b2c.littlefounders.ai/'],
    ['the wrong port on localhost', 'http://localhost:4011/'],
    ['https on a localhost port that is http only', 'https://localhost:4010/'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a data URL', 'data:text/html,<script>1</script>'],
    ['a relative path', '/play'],
    ['a protocol-relative URL', '//game-b2c.littlefounders.ai/'],
    ['the empty string', ''],
    ['a subdomain of the production domain', 'https://evil.littlefounders.ai/'],
    ['the apex domain', 'https://littlefounders.ai/'],
  ])('refuses %s', (_label, url) => {
    expect(acceptGameUrl(url)).toBeNull();
  });

  it.each([null, undefined, 4, {}, ['https://game-b2c.littlefounders.ai/']])('refuses a non-string %j', (value) => {
    expect(acceptGameUrl(value)).toBeNull();
  });

  it('refuses an absurdly long URL', () => {
    expect(acceptGameUrl(`https://game-b2c.littlefounders.ai/?${'a'.repeat(2100)}`)).toBeNull();
  });

  it('returns the parser-normalised URL, not the raw string', () => {
    expect(acceptGameUrl('https://GAME-B2C.littlefounders.ai:443/x')?.href).toBe('https://game-b2c.littlefounders.ai/x?embed=1');
  });

  it('forces embed mode on: a bare origin, a missing flag or a conflicting flag all load the game as an embed', () => {
    expect(acceptGameUrl('https://kartrush-production.up.railway.app')?.href).toBe('https://kartrush-production.up.railway.app/?embed=1');
    expect(acceptGameUrl('https://kartrush-production.up.railway.app/?embed=0')?.href).toBe('https://kartrush-production.up.railway.app/?embed=1');
    expect(acceptGameUrl('https://kartrush-production.up.railway.app/?a=1&embed=1')?.href).toBe('https://kartrush-production.up.railway.app/?a=1&embed=1');
  });
});
