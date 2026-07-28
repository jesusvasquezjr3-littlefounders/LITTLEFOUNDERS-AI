import { z } from 'zod';

/*
 * Env validated once at boot (agent/core/CONVENTIONS.md). Tests set
 * process.env in test-setup before the first getConfig() call.
 *
 * Voice resolution is two-tier: TTS_VOICE_{EN_US,ES_MX,PT_BR} are per-locale
 * defaults; TTS_VOICE_<CHARACTER>_<LOCALE> (12 vars, all optional) override
 * per canon character when a segment's narrator is known — see `voiceFor()`
 * below and README.md "Voice map".
 */
const Env = z.object({
  PORT: z.coerce.number().int().positive().default(4002),

  // Service-to-service auth (/AGENTS.md §1.5).
  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be at least 16 chars'),

  // TTS provider — DashScope (Qwen3-TTS), decision RESOLVED (audiogen/AGENTS.md).
  TTS_API_URL: z
    .url()
    .default('https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'),
  TTS_API_KEY: z.string().min(1, 'TTS_API_KEY is required'),
  TTS_MODEL: z.string().min(1).default('qwen3-tts-flash'),

  // Voice-clone ENROLLMENT (a different endpoint from synthesis above) +
  // the model a cloned voice is bound to — DashScope requires target_model
  // at enrollment to exactly match the model used at synthesis time, so a
  // character-override voice (see below) ALWAYS pairs with this model, never
  // TTS_MODEL. See src/tts/voiceClone.ts + scripts/register-character-voices.ts.
  TTS_ENROLLMENT_API_URL: z
    .url()
    .default('https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/customization'),
  TTS_CLONE_MODEL: z.string().min(1).default('qwen3-tts-vc-2026-01-22'),

  // ElevenLabs is used ONLY for sound-effect generation (owner decision
  // 2026-07-23: "QWEN SE QUEDA PARA TTS, ELEVENLABS ES SOLO PARA EFECTOS DE
  // SONIDO") — narration/TTS stays qwen3-tts. The key is read by the one-off
  // SFX generation script, never by the narration path.
  ELEVENLABS_API_KEY: z.string().optional(),

  // Per-locale default voices — used whenever a segment has no narrator, or
  // the narrator's character has no override below for that locale.
  TTS_VOICE_EN_US: z.string().min(1).default('Jennifer'),
  TTS_VOICE_ES_MX: z.string().min(1).default('Li'),
  TTS_VOICE_PT_BR: z.string().min(1).default('Ryan'),

  // Per-character × per-locale voice overrides (the "voice map" — README.md
  // "Voice map" section). All optional: an unset var falls back to the
  // locale default above. Populated by `npm run voices:register` (writes
  // the cloned voice id per character/locale here) — always paired with
  // TTS_CLONE_MODEL at synthesis time, never TTS_MODEL.
  TTS_VOICE_DINA_EN_US: z.string().min(1).optional(),
  TTS_VOICE_DINA_ES_MX: z.string().min(1).optional(),
  TTS_VOICE_DINA_PT_BR: z.string().min(1).optional(),
  TTS_VOICE_LIRUF_EN_US: z.string().min(1).optional(),
  TTS_VOICE_LIRUF_ES_MX: z.string().min(1).optional(),
  TTS_VOICE_LIRUF_PT_BR: z.string().min(1).optional(),
  TTS_VOICE_RHO_EN_US: z.string().min(1).optional(),
  TTS_VOICE_RHO_ES_MX: z.string().min(1).optional(),
  TTS_VOICE_RHO_PT_BR: z.string().min(1).optional(),
  TTS_VOICE_ZARA_EN_US: z.string().min(1).optional(),
  TTS_VOICE_ZARA_ES_MX: z.string().min(1).optional(),
  TTS_VOICE_ZARA_PT_BR: z.string().min(1).optional(),

  // Vault (Supabase self-hosted) — service role, bypasses RLS by design
  // (lesson_documents writes are a service-role-only surface, mirroring
  // backend/src/services/supabaseRest.ts's asServiceRole() pattern).
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Filebase — internal upload service (contract in README.md).
  FILEBASE_URL: z.url(),
  FILEBASE_INTERNAL_KEY: z.string().min(16, 'FILEBASE_INTERNAL_KEY must be at least 16 chars'),

  // Batch narration is an OPERATOR-OPT-IN, paid action (/AGENTS.md §1.9 BOUNDARIES).
  AUDIOGEN_RUN_ON_START: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  AUDIOGEN_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  AUDIOGEN_MP3_BITRATE_KBPS: z.coerce.number().int().min(16).max(320).default(48),
});

export type Config = Readonly<z.infer<typeof Env>>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (!cached) cached = Object.freeze(Env.parse(process.env));
  return cached;
}

/** Test-only: force re-read of process.env on the next getConfig() call. */
export function resetConfigCache(): void {
  cached = null;
}

const LANGUAGE_TYPE_BY_LOCALE = {
  'en-US': 'English',
  'es-MX': 'Spanish',
  'pt-BR': 'Portuguese',
} as const;

export type LessonLocale = keyof typeof LANGUAGE_TYPE_BY_LOCALE;

export function languageTypeFor(locale: LessonLocale): string {
  return LANGUAGE_TYPE_BY_LOCALE[locale];
}

export function defaultVoiceFor(locale: LessonLocale, config: Config): string {
  const byLocale: Record<LessonLocale, string> = {
    'en-US': config.TTS_VOICE_EN_US,
    'es-MX': config.TTS_VOICE_ES_MX,
    'pt-BR': config.TTS_VOICE_PT_BR,
  };
  return byLocale[locale];
}

/** The four canonical mascots (frontend/src/components/characters/) — the only valid voice-map keys. */
export const CANON_CHARACTERS = ['dina', 'liruf', 'rho', 'zara'] as const;
export type CanonCharacter = (typeof CANON_CHARACTERS)[number];

const CHARACTER_VOICE_ENV: Record<CanonCharacter, Record<LessonLocale, keyof Config>> = {
  dina: { 'en-US': 'TTS_VOICE_DINA_EN_US', 'es-MX': 'TTS_VOICE_DINA_ES_MX', 'pt-BR': 'TTS_VOICE_DINA_PT_BR' },
  liruf: { 'en-US': 'TTS_VOICE_LIRUF_EN_US', 'es-MX': 'TTS_VOICE_LIRUF_ES_MX', 'pt-BR': 'TTS_VOICE_LIRUF_PT_BR' },
  rho: { 'en-US': 'TTS_VOICE_RHO_EN_US', 'es-MX': 'TTS_VOICE_RHO_ES_MX', 'pt-BR': 'TTS_VOICE_RHO_PT_BR' },
  zara: { 'en-US': 'TTS_VOICE_ZARA_EN_US', 'es-MX': 'TTS_VOICE_ZARA_ES_MX', 'pt-BR': 'TTS_VOICE_ZARA_PT_BR' },
};

function isCanonCharacter(value: string): value is CanonCharacter {
  return (CANON_CHARACTERS as readonly string[]).includes(value);
}

export interface ResolvedVoice {
  voice: string;
  /** The synthesis model this voice must be paired with (a cloned voice is bound to exactly one model). */
  model: string;
}

/**
 * Resolves the voice (AND its required model) for one narration unit
 * (COURSE_ENGINE.md §7 — "voice = the segment's narrator character"). Falls
 * back to the locale default + TTS_MODEL when the unit has no narrator, the
 * narrator isn't one of the 4 canon characters, or that character has no
 * override set for this locale yet. A character override ALWAYS pairs with
 * TTS_CLONE_MODEL — it can only ever be a cloned voice id (DashScope binds
 * every voice to the exact model it was enrolled under).
 */
export function voiceFor(character: string | undefined, locale: LessonLocale, config: Config): ResolvedVoice {
  if (character && isCanonCharacter(character)) {
    const envKey = CHARACTER_VOICE_ENV[character][locale];
    const override = config[envKey] as string | undefined;
    if (override) return { voice: override, model: config.TTS_CLONE_MODEL };
  }
  return { voice: defaultVoiceFor(locale, config), model: config.TTS_MODEL };
}

