import { z } from 'zod';

/*
 * Env validated once at boot (agent/core/CONVENTIONS.md). Tests set
 * process.env in test-setup before the first getConfig() call.
 *
 * Voice defaults below are PLACEHOLDER per-locale voices for Qwen3-TTS
 * (qwen3-tts-flash). Final CHARACTER voices (Dina/Dino/Rho/Zara, per
 * locale) land later via a voice map keyed by CharacterId — see README.md
 * "Voice map" section and AGENTS.md.
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

  // Per-locale default voices (placeholder until the character voice map lands).
  TTS_VOICE_EN_US: z.string().min(1).default('Jennifer'),
  TTS_VOICE_ES_MX: z.string().min(1).default('Li'),
  TTS_VOICE_PT_BR: z.string().min(1).default('Ryan'),

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
