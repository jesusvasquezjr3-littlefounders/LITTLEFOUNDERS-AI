import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getConfig, resetConfigCache, requireGenerationKeys, requirePublishKeys } from '../env.js';

const SNAPSHOT_KEYS = ['DEEPSEEK_API_KEY', 'QWEN_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
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
    expect(c.DEEPSEEK_MODEL).toBe('deepseek-chat');
    expect(c.QWEN_JUDGE_MODEL).toBe('qwen3-max');
    expect(c.FORGE_CONCURRENCY).toBe(2);
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
