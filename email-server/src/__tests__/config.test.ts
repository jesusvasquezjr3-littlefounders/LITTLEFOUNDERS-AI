import { beforeEach, describe, expect, it } from 'vitest';
import { getConfig, resetConfigForTests } from '../config.js';

describe('getConfig', () => {
  beforeEach(() => {
    resetConfigForTests();
    delete process.env.EMAIL_ENGINE;
    delete process.env.SES_RELAY_HOST;
    delete process.env.SES_SMTP_USER;
    delete process.env.SES_SMTP_PASS;
    delete process.env.INTERNAL_API_KEY;
    process.env.NODE_ENV = 'test';
  });

  it('defaults to the noop engine outside production', () => {
    const c = getConfig();
    expect(c.EMAIL_ENGINE).toBe('noop');
    expect(c.PORT).toBe(4005);
  });

  it('requires SES credentials when the engine is haraka', () => {
    process.env.EMAIL_ENGINE = 'haraka';
    expect(() => getConfig()).toThrow(/SES_RELAY_HOST/);
  });

  it('accepts the haraka engine when SES credentials are present', () => {
    process.env.EMAIL_ENGINE = 'haraka';
    process.env.SES_RELAY_HOST = 'email-smtp.us-east-1.amazonaws.com';
    process.env.SES_SMTP_USER = 'AKIAEXAMPLE';
    process.env.SES_SMTP_PASS = 'a-real-looking-secret';
    const c = getConfig();
    expect(c.EMAIL_ENGINE).toBe('haraka');
    expect(c.SES_RELAY_HOST).toBe('email-smtp.us-east-1.amazonaws.com');
    expect(c.SES_RELAY_PORT).toBe(587);
  });

  it('crashes at boot if INTERNAL_API_KEY is missing in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => getConfig()).toThrow(/INTERNAL_API_KEY/);
  });
});
