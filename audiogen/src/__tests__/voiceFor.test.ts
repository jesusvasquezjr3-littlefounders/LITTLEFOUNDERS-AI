import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getConfig, resetConfigCache, voiceFor, defaultVoiceFor } from '../env.js';

const CHARACTER_ENV_KEYS = [
  'TTS_VOICE_DINA_EN_US',
  'TTS_VOICE_DINA_ES_MX',
  'TTS_VOICE_DINA_PT_BR',
  'TTS_VOICE_DINO_EN_US',
  'TTS_VOICE_DINO_ES_MX',
  'TTS_VOICE_DINO_PT_BR',
  'TTS_VOICE_RHO_EN_US',
  'TTS_VOICE_RHO_ES_MX',
  'TTS_VOICE_RHO_PT_BR',
  'TTS_VOICE_ZARA_EN_US',
  'TTS_VOICE_ZARA_ES_MX',
  'TTS_VOICE_ZARA_PT_BR',
] as const;

beforeEach(() => {
  for (const key of CHARACTER_ENV_KEYS) delete process.env[key];
  resetConfigCache();
});

afterEach(() => {
  for (const key of CHARACTER_ENV_KEYS) delete process.env[key];
  resetConfigCache();
});

describe('voiceFor (per-character voice map, COURSE_ENGINE.md §7)', () => {
  it('falls back to the locale default when no character is given', () => {
    const config = getConfig();
    expect(voiceFor(undefined, 'en-US', config)).toBe(defaultVoiceFor('en-US', config));
  });

  it('falls back to the locale default when the character has no override set', () => {
    const config = getConfig();
    expect(voiceFor('dina', 'es-MX', config)).toBe(defaultVoiceFor('es-MX', config));
  });

  it('falls back to the locale default for an unknown/non-canon character string', () => {
    const config = getConfig();
    expect(voiceFor('narrator-of-mystery', 'en-US', config)).toBe(defaultVoiceFor('en-US', config));
  });

  it('uses the character override when set, per locale', () => {
    process.env.TTS_VOICE_ZARA_ES_MX = 'Katerina';
    resetConfigCache();
    const config = getConfig();
    expect(voiceFor('zara', 'es-MX', config)).toBe('Katerina');
    // A different locale for the same character, still unset, still falls back.
    expect(voiceFor('zara', 'en-US', config)).toBe(defaultVoiceFor('en-US', config));
  });

  it('resolves independently per character (no cross-talk between characters)', () => {
    process.env.TTS_VOICE_DINA_EN_US = 'VoiceA';
    process.env.TTS_VOICE_DINO_EN_US = 'VoiceB';
    resetConfigCache();
    const config = getConfig();
    expect(voiceFor('dina', 'en-US', config)).toBe('VoiceA');
    expect(voiceFor('dino', 'en-US', config)).toBe('VoiceB');
    expect(voiceFor('rho', 'en-US', config)).toBe(defaultVoiceFor('en-US', config));
  });
});
