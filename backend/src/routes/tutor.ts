import { Router } from 'express';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import {
  getFullOwnProfile,
  getPublishedTutorPackKeys,
  getPublishedTutorPacks,
  getTutorSituations,
} from '../services/supabaseRest.js';

/*
 * /api/v1/tutor — Oracle v1: Money Moments (Little Language Lessons' Tiny
 * Lesson pattern made §1.9-safe). The kid picks from a CURATED situation
 * taxonomy — free text never reaches a provider — and Core serves packs that
 * were generated offline, validated, and HUMAN-published. "On demand" is a
 * Vault read: zero runtime AI in front of a child, zero latency.
 */

const NOT_FOUND = 'NOT_FOUND';
const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';
const LOCALES = new Set(['en-US', 'es-MX', 'pt-BR']);
const AUTHORING_LOCALE = 'es-MX';

/** Age band → tier (COURSE_ENGINE.md §3.1b). No/unknown birth date → tier2, the middle band. */
export function tierForBirthDate(birthDate: string | null, today = new Date()): string {
  if (!birthDate) return 'tier2';
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return 'tier2';
  let age = today.getFullYear() - born.getFullYear();
  const beforeBirthday =
    today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  if (age <= 7) return 'tier1';
  if (age <= 9) return 'tier2';
  return 'tier3';
}

/** Best published pack for (tier, locale): exact → same tier in es-MX → any tier in locale → any. */
export function pickPack<T extends { tier: string; locale: string }>(packs: T[], tier: string, locale: string): T | null {
  return (
    packs.find((p) => p.tier === tier && p.locale === locale) ??
    packs.find((p) => p.tier === tier && p.locale === AUTHORING_LOCALE) ??
    packs.find((p) => p.locale === locale) ??
    packs[0] ??
    null
  );
}

export function tutorRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  /** The situation picker: curated list + per-situation availability for THIS caller's tier/locale. */
  router.get('/situations', async (_req, res) => {
    const user = authedUser(res);
    const [situations, packKeys, profileRows] = await Promise.all([
      getTutorSituations(),
      getPublishedTutorPackKeys(),
      getFullOwnProfile(user.accessToken, user.id),
    ]);
    if (!situations || !packKeys) return fail(res, 502, DATA_UNAVAILABLE, 'Tutor content unreachable');
    const profile = profileRows?.[0] ?? null;
    const tier = tierForBirthDate(profile?.birth_date ?? null);
    const locale = profile && LOCALES.has(profile.locale) ? profile.locale : AUTHORING_LOCALE;

    const available = new Set(
      packKeys.filter((k) => k.tier === tier || k.locale === locale || k.locale === AUTHORING_LOCALE).map((k) => k.situation_id),
    );
    return ok(res, {
      tier,
      locale,
      situations: situations.map((s) => ({
        id: s.id,
        icon: s.icon,
        title: s.title,
        description: s.description,
        available: available.has(s.id),
      })),
    });
  });

  /** One situation's pack, resolved to the caller's tier + locale with sane fallbacks. */
  router.get('/situations/:id/pack', async (req, res) => {
    const user = authedUser(res);
    const situationId = req.params.id as string;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(situationId)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid situation id');
    }
    const [packs, profileRows] = await Promise.all([
      getPublishedTutorPacks(situationId),
      getFullOwnProfile(user.accessToken, user.id),
    ]);
    if (!packs) return fail(res, 502, DATA_UNAVAILABLE, 'Tutor content unreachable');
    const profile = profileRows?.[0] ?? null;
    const tier = tierForBirthDate(profile?.birth_date ?? null);
    const locale = profile && LOCALES.has(profile.locale) ? profile.locale : AUTHORING_LOCALE;

    const chosen = pickPack(packs, tier, locale);
    if (!chosen) return fail(res, 404, NOT_FOUND, 'No published pack for this situation yet');
    return ok(res, { situationId, tier: chosen.tier, locale: chosen.locale, pack: chosen.pack });
  });

  return router;
}
