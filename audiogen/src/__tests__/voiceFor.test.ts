import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getConfig, resetConfigCache, voiceFor, defaultVoiceFor } from '../env.js';

const CHARACTER_ENV_KEYS = [
  'TTS_VOICE_DINA_EN_US',
  'TTS_VOICE_DINA_ES_MX',
  'TTS_VOICE_DINA_PT_BR',
  'TTS_VOICE_LIRUF_EN_US',
  'TTS_VOICE_LIRUF_ES_MX',
  'TTS_VOICE_LIRUF_PT_BR',
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
  it('falls back to the locale default + TTS_MODEL when no character is given', () => {
    const config = getConfig();
    expect(voiceFor(undefined, 'en-US', config)).toEqual({ voice: defaultVoiceFor('en-US', config), model: config.TTS_MODEL });
  });

  it('falls back to the locale default + TTS_MODEL when the character has no override set', () => {
    const config = getConfig();
    expect(voiceFor('dina', 'es-MX', config)).toEqual({ voice: defaultVoiceFor('es-MX', config), model: config.TTS_MODEL });
  });

  it('falls back to the locale default + TTS_MODEL for an unknown/non-canon character string', () => {
    const config = getConfig();
    expect(voiceFor('narrator-of-mystery', 'en-US', config)).toEqual({ voice: defaultVoiceFor('en-US', config), model: config.TTS_MODEL });
  });

  it('uses the character override + TTS_CLONE_MODEL when set, per locale', () => {
    process.env.TTS_VOICE_ZARA_ES_MX = 'Katerina';
    resetConfigCache();
    const config = getConfig();
    expect(voiceFor('zara', 'es-MX', config)).toEqual({ voice: 'Katerina', model: config.TTS_CLONE_MODEL });
    // A different locale for the same character, still unset, still falls back to the default model.
    expect(voiceFor('zara', 'en-US', config)).toEqual({ voice: defaultVoiceFor('en-US', config), model: config.TTS_MODEL });
  });

  it('resolves independently per character (no cross-talk between characters)', () => {
    process.env.TTS_VOICE_DINA_EN_US = 'VoiceA';
    process.env.TTS_VOICE_LIRUF_EN_US = 'VoiceB';
    resetConfigCache();
    const config = getConfig();
    expect(voiceFor('dina', 'en-US', config)).toEqual({ voice: 'VoiceA', model: config.TTS_CLONE_MODEL });
    expect(voiceFor('liruf', 'en-US', config)).toEqual({ voice: 'VoiceB', model: config.TTS_CLONE_MODEL });
    expect(voiceFor('rho', 'en-US', config)).toEqual({ voice: defaultVoiceFor('en-US', config), model: config.TTS_MODEL });
  });
});
