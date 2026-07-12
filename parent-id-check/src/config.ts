import { z } from 'zod';

/*
 * Env is validated once at boot (agent/core/CONVENTIONS.md) — the service
 * crashes on invalid config, never at request time. Tests import getConfig()
 * after setting process.env in test-setup.
 */
const Env = z.object({
  PORT: z.coerce.number().int().positive().default(4004),
  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be at least 16 chars'),
  // OCR languages for tesseract.js (matches the platform locales).
  OCR_LANGUAGES: z.string().default('spa+eng+por'),
});

export type Config = Readonly<z.infer<typeof Env>>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (!cached) cached = Object.freeze(Env.parse(process.env));
  return cached;
}
