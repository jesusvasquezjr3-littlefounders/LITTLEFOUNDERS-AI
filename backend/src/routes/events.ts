import express, { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { eventsRateLimiter } from '../middleware/rateLimit.js';
import {
  DEVICES,
  LOCALES,
  RECORDABLE_EVENTS,
  REFERRER_CLASSES,
  ROUTE_CLASSES,
  attributeSignup,
  getRolesForGate,
  hasActiveAnalyticsConsent,
  insertLearningEvents,
  stampRole,
  upsertAnonVisitor,
  type LearningEventInsert,
} from '../services/insights.js';

/*
 * POST /api/v1/events — first-party usage telemetry ingest (/INSIGHTS.md).
 *
 * TWO identities, never both:
 *  - AUTHENTICATED (Authorization header): user_id + role stamped from the
 *    session and a SERVICE-ROLE read of user_roles — never the caller's own
 *    RLS-scoped read, which would turn a lost SELECT policy into every kid
 *    being reclassified as an adult. An EMPTY role set is unconfirmed and
 *    goes THROUGH the kid gate, not around it.
 *  - ANONYMOUS (anonId in the body, from our first-party lf_aid cookie): the
 *    acquisition funnel. Marketing surfaces only — an anonymous batch may
 *    NOT carry product events, because "anonymous" on a product surface just
 *    means "a kid whose consent we haven't checked".
 *
 * §1.9 gate (authenticated): when the caller is — or might be — a kid,
 * events are recorded ONLY while guardian consent is active. No consent, or
 * Vault unable to answer, means the batch is acknowledged and DROPPED
 * (202, accepted: 0).
 *
 * Tolerance: events validate INDIVIDUALLY. One bad value must not destroy
 * the other 24 in a flush.
 */

/** Surfaces an anonymous (pre-signup) visitor is allowed to report from. */
const ANON_ROUTE_CLASSES = new Set(['marketing', 'other']);
/*
 * Events an anonymous visitor is allowed to report. Acquisition funnel ONLY.
 *
 * signup_complete / login_complete belong here even though an account now
 * exists: they are emitted in the same tick the session is created, while the
 * beacon is still in anonymous mode, so excluding them silently dropped the
 * funnel's most important step (step 3 "signed_up" could never be non-zero).
 * They are safe on this path because they carry no product behaviour, and a
 * brand-new account is `universal` by DB trigger — an account only becomes a
 * kid later, through verified-guardian linking.
 */
const ANON_EVENTS = new Set([
  'page_view', 'cta_click', 'scroll_depth',
  'signup_start', 'signup_submit', 'signup_complete', 'login_complete',
  'session_start', 'session_end', 'nav_view',
]);

const EventBody = z.object({
  event: z.enum(RECORDABLE_EVENTS),
  routeClass: z.enum(ROUTE_CLASSES).optional(),
  lessonId: z.string().uuid().optional(),
  // Content-id charset (mirrors the 0023 CHECK) — a length cap alone would
  // leave a free-text channel into a table §1.9 promises has none.
  segmentId: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/).optional(),
  value: z.number().finite().min(0).max(86_400).optional(),
  sessionId: z.string().uuid().optional(),
  device: z.enum(DEVICES).optional(),
  locale: z.enum(LOCALES).optional(),
  referrerClass: z.enum(REFERRER_CLASSES).optional(),
  ordinal: z.number().int().min(1).max(100_000).optional(),
});

const LABEL = /^[A-Za-z0-9._-]{1,64}$/;

const BatchBody = z.object({
  events: z.array(z.unknown()).min(1).max(25),
  /** First-party visitor id (lf_aid). Present only for anonymous batches. */
  anonId: z.string().uuid().optional(),
  /** Acquisition context, sent once when the visitor is first registered. */
  visitor: z
    .object({
      referrerClass: z.enum(REFERRER_CLASSES).optional(),
      utmSource: z.string().regex(LABEL).optional(),
      utmMedium: z.string().regex(LABEL).optional(),
      utmCampaign: z.string().regex(LABEL).optional(),
      landingRoute: z.string().regex(/^[A-Za-z0-9/_-]{1,120}$/).optional(),
      device: z.enum(DEVICES).optional(),
      locale: z.enum(LOCALES).optional(),
    })
    .optional(),
});

function toRow(e: z.infer<typeof EventBody>): Omit<LearningEventInsert, 'role'> {
  return {
    event: e.event,
    route_class: e.routeClass ?? null,
    lesson_id: e.lessonId ?? null,
    segment_id: e.segmentId ?? null,
    value: e.value !== undefined ? Math.round(e.value * 100) / 100 : null,
    session_id: e.sessionId ?? null,
    device: e.device ?? null,
    locale: e.locale ?? null,
    referrer_class: e.referrerClass ?? null,
    ordinal: e.ordinal ?? null,
  };
}

export function eventsRouter(): Router {
  const router = Router();
  // Mounted above the app-level json parser (this router sits above the
  // global limiter), so it parses its own bodies — tightly capped.
  router.use(eventsRateLimiter, express.json({ limit: '16kb' }));

  router.post('/', async (req, res, next) => {
    const parsed = BatchBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'events must be an array of 1-25 items');
    }

    // Anonymous path: no Authorization header AND an anonId present.
    const hasAuth = (req.get('authorization') ?? '').startsWith('Bearer ');
    if (!hasAuth && parsed.data.anonId) {
      const anonId = parsed.data.anonId;
      if (parsed.data.visitor) {
        await upsertAnonVisitor({
          anon_id: anonId,
          referrer_class: parsed.data.visitor.referrerClass ?? null,
          utm_source: parsed.data.visitor.utmSource ?? null,
          utm_medium: parsed.data.visitor.utmMedium ?? null,
          utm_campaign: parsed.data.visitor.utmCampaign ?? null,
          landing_route: parsed.data.visitor.landingRoute ?? null,
          device: parsed.data.visitor.device ?? null,
          locale: parsed.data.visitor.locale ?? null,
        });
      } else {
        // The FK requires the visitor row to exist before any event.
        await upsertAnonVisitor({ anon_id: anonId });
      }

      const rows: LearningEventInsert[] = [];
      for (const raw of parsed.data.events) {
        const e = EventBody.safeParse(raw);
        if (!e.success) continue;
        // An anonymous caller may only speak about acquisition surfaces.
        // Anything else would be an unidentified — possibly kid — session
        // reporting product behaviour outside the consent gate.
        if (!ANON_EVENTS.has(e.data.event)) continue;
        if (e.data.routeClass && !ANON_ROUTE_CLASSES.has(e.data.routeClass)) continue;
        rows.push({ ...toRow(e.data), anon_id: anonId, user_id: null, role: 'anon' });
      }
      if (rows.length === 0) return ok(res, { accepted: 0 }, 202);
      const storedAnon = await insertLearningEvents(rows);
      if (!storedAnon) return fail(res, 502, 'DATA_UNAVAILABLE', 'Events could not be stored');
      return ok(res, { accepted: rows.length }, 202);
    }

    // Authenticated path. requireAuth is applied as real middleware on this
    // sub-route rather than called inline, so its 401 shape and res.locals
    // contract stay identical to every other authenticated route.
    return next();
  }, requireAuth, async (req, res) => {
    const parsed = BatchBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'events must be an array of 1-25 items');
    }
    const user = authedUser(res);
    const roles = await getRolesForGate(user.id);
    if (roles === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve roles');

    // Kid, OR unconfirmed (empty role set): through the consent gate.
    if (roles.length === 0 || roles.includes('kid')) {
      const consent = await hasActiveAnalyticsConsent(user.id);
      if (consent !== true) return ok(res, { accepted: 0 }, 202);
    }

    const role = roles.length === 0 ? 'kid' : stampRole(roles);
    const rows: LearningEventInsert[] = [];
    for (const raw of parsed.data.events) {
      const e = EventBody.safeParse(raw);
      if (!e.success) continue; // drop the bad apple, keep the batch
      rows.push({ ...toRow(e.data), user_id: user.id, anon_id: null, role });
    }

    if (rows.length === 0) return ok(res, { accepted: 0 }, 202);
    const stored = await insertLearningEvents(rows);
    if (!stored) return fail(res, 502, 'DATA_UNAVAILABLE', 'Events could not be stored');

    /*
     * CLOSE THE ATTRIBUTION LOOP HERE, not only in /auth/signup.
     *
     * The signup route can only attribute the visitors that pass through it —
     * which excludes every Google sign-in, since OAuth returns straight to the
     * SPA and never touches it. Those accounts were being recorded as
     * unattributed, AND the retention prune then deleted their anon_visitors
     * rows as non-converters, so a campaign that produced Google signups
     * showed zero conversions forever.
     *
     * Doing it on the conversion EVENT instead covers every path — email,
     * OAuth, and anything added later — without each one remembering to.
     * attributeSignup is idempotent (first conversion wins) and refuses kids,
     * so calling it on every login is safe. Fire-and-forget: attribution is
     * never a reason to fail an event batch.
     */
    if (parsed.data.anonId && rows.some((r) => r.event === 'signup_complete' || r.event === 'login_complete')) {
      void attributeSignup(parsed.data.anonId, user.id, roles);
    }
    return ok(res, { accepted: rows.length }, 202);
  });

  return router;
}
