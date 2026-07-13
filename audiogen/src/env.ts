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

  // Per-locale default voices — used whenever a segment has no narrator, or
  // the narrator's character has no override below for that locale.
  TTS_VOICE_EN_US: z.string().min(1).default('Jennifer'),
  TTS_VOICE_ES_MX: z.string().min(1).default('Li'),
  TTS_VOICE_PT_BR: z.string().min(1).default('Ryan'),

  // Per-character × per-locale voice overrides (the "voice map" — README.md
  // "Voice map" section). All optional: an unset var falls back to the
  // locale default above. Each value is just a `voice` string handed to
  // synthesizeSpeech() — it works identically whether that string is a
  // DashScope BUILT-IN preset name (e.g. "Cherry") or a CLONED voice id
  // registered from a reference sample (the exact registration flow is a
  // separate, not-yet-implemented step — once a clone id exists for a
  // character/locale, set it here and no code changes are needed).
  TTS_VOICE_DINA_EN_US: z.string().min(1).optional(),
  TTS_VOICE_DINA_ES_MX: z.string().min(1).optional(),
  TTS_VOICE_DINA_PT_BR: z.string().min(1).optional(),
  TTS_VOICE_DINO_EN_US: z.string().min(1).optional(),
  TTS_VOICE_DINO_ES_MX: z.string().min(1).optional(),
  TTS_VOICE_DINO_PT_BR: z.string().min(1).optional(),
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
export const CANON_CHARACTERS = ['dina', 'dino', 'rho', 'zara'] as const;
export type CanonCharacter = (typeof CANON_CHARACTERS)[number];

const CHARACTER_VOICE_ENV: Record<CanonCharacter, Record<LessonLocale, keyof Config>> = {
  dina: { 'en-US': 'TTS_VOICE_DINA_EN_US', 'es-MX': 'TTS_VOICE_DINA_ES_MX', 'pt-BR': 'TTS_VOICE_DINA_PT_BR' },
  dino: { 'en-US': 'TTS_VOICE_DINO_EN_US', 'es-MX': 'TTS_VOICE_DINO_ES_MX', 'pt-BR': 'TTS_VOICE_DINO_PT_BR' },
  rho: { 'en-US': 'TTS_VOICE_RHO_EN_US', 'es-MX': 'TTS_VOICE_RHO_ES_MX', 'pt-BR': 'TTS_VOICE_RHO_PT_BR' },
  zara: { 'en-US': 'TTS_VOICE_ZARA_EN_US', 'es-MX': 'TTS_VOICE_ZARA_ES_MX', 'pt-BR': 'TTS_VOICE_ZARA_PT_BR' },
};

function isCanonCharacter(value: string): value is CanonCharacter {
  return (CANON_CHARACTERS as readonly string[]).includes(value);
}

/**
 * Resolves the voice for one narration unit (COURSE_ENGINE.md §7 — "voice =
 * the segment's narrator character"). Falls back to `defaultVoiceFor` when
 * the unit has no narrator, the narrator isn't one of the 4 canon
 * characters, or that character has no override set for this locale yet.
 */
export function voiceFor(character: string | undefined, locale: LessonLocale, config: Config): string {
  if (character && isCanonCharacter(character)) {
    const envKey = CHARACTER_VOICE_ENV[character][locale];
    const override = config[envKey] as string | undefined;
    if (override) return override;
  }
  return defaultVoiceFor(locale, config);
}
