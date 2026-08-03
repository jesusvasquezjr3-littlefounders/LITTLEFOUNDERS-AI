import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getConfig, resetConfigCache, requireGenerationKeys, requirePictureGeneration, requirePublishKeys } from '../env.js';

const SNAPSHOT_KEYS = ['DEEPSEEK_API_KEY', 'QWEN_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PICTUREGEN_URL', 'PICTUREGEN_INTERNAL_KEY', 'FORGE_DEEPSEEK_FALLBACK_TO_QWEN'] as const;
let snapshot: Record<string, string | undefined>;

beforeEach(() => {
  snapshot = Object.fromEntries(SNAPSHOT_KEYS.map((k) => [k, process.env[k]]));
  for (const k of SNAPSHOT_KEYS) delete process.env[k];
  resetConfigCache();
});

afterEach(() => {
  for (const k of SNAPSHOT_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
  resetConfigCache();
});

describe('getConfig', () => {
  it('parses successfully with NO provider keys set — offline commands never require them', () => {
    expect(() => getConfig()).not.toThrow();
    const c = getConfig();
    expect(c.DEEPSEEK_API_KEY).toBeUndefined();
    expect(c.QWEN_API_KEY).toBeUndefined();
  });

  it('applies documented defaults', () => {
    const c = getConfig();
    expect(c.DEEPSEEK_MODEL).toBe('deepseek-v4-pro');
    expect(c.QWEN_JUDGE_MODEL).toBe('qwen3-max');
    expect(c.FORGE_DEEPSEEK_FALLBACK_TO_QWEN).toBe(true);
    expect(c.FORGE_QWEN_FALLBACK_TIMEOUT_MS).toBe(180_000);
    expect(c.FORGE_CONCURRENCY).toBe(2);
  });
});

describe('FORGE_DEEPSEEK_FALLBACK_TO_QWEN — strict string-boolean (§1.14)', () => {
  it.each<[string, boolean]>([
    ['false', false],
    ['0', false],
    ['no', false],
    ['FALSE', false],
    ['true', true],
    ['1', true],
    ['yes', true],
  ])('parses %j as %s — z.coerce.boolean() read every non-empty string (including "false") as true', (raw, expected) => {
    process.env.FORGE_DEEPSEEK_FALLBACK_TO_QWEN = raw;
    resetConfigCache();
    expect(getConfig().FORGE_DEEPSEEK_FALLBACK_TO_QWEN).toBe(expected);
  });

  it('REJECTS a value that is neither truthy nor falsy instead of silently coercing it', () => {
    process.env.FORGE_DEEPSEEK_FALLBACK_TO_QWEN = 'banana';
    resetConfigCache();
    expect(() => getConfig()).toThrow();
  });

  it('defaults to true when unset', () => {
    expect(getConfig().FORGE_DEEPSEEK_FALLBACK_TO_QWEN).toBe(true);
  });
});

describe('requireGenerationKeys', () => {
  it('throws a clear error listing missing keys', () => {
    expect(() => requireGenerationKeys()).toThrow(/DEEPSEEK_API_KEY.*QWEN_API_KEY|QWEN_API_KEY.*DEEPSEEK_API_KEY/);
  });

  it('passes once both keys are set', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test-1';
    process.env.QWEN_API_KEY = 'sk-test-2';
    resetConfigCache();
    expect(() => requireGenerationKeys()).not.toThrow();
  });
});

describe('requirePublishKeys', () => {
  it('throws when Vault credentials are missing', () => {
    expect(() => requirePublishKeys()).toThrow(/SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  });
});

describe('requirePictureGeneration', () => {
  it('fails before a production visual run when Prism is not configured', () => {
    expect(() => requirePictureGeneration()).toThrow(/PICTUREGEN_URL.*PICTUREGEN_INTERNAL_KEY|PICTUREGEN_INTERNAL_KEY.*PICTUREGEN_URL/);
  });

  it('accepts a complete internal Prism configuration', () => {
    process.env.PICTUREGEN_URL = 'http://picturegen.test:4007';
    process.env.PICTUREGEN_INTERNAL_KEY = 'test-internal-picture-key';
    resetConfigCache();
    expect(() => requirePictureGeneration()).not.toThrow();
  });
});
