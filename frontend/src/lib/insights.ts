import { api, BASE_URL } from './api';
import {
  collectVisitorContext,
  detectDevice,
  getAnonId,
  hasCookieConsent,
  type Device,
  type ReferrerClass,
  type VisitorContext,
} from './visitor';

/*
 * First-party usage beacon (/INSIGHTS.md). Batches closed-vocabulary events
 * to Core's POST /api/v1/events — never to Pulse, never to any third party.
 *
 * The privacy posture is layered and this file is the OUTERMOST layer:
 *  - configure() is called with `enabled` derived from /me's
 *    analyticsEnabled — false for a kid without active guardian consent, so
 *    an unconsented kid's browser does not even TRANSMIT.
 *  - The server re-checks consent authoritatively on every batch and stamps
 *    identity/role itself; nothing this file sends is trusted for either.
 *  - The event vocabulary is a closed enum end to end; there is no free-text
 *    field to put anything in.
 *
 * Telemetry must never hurt the product: track() is synchronous and cheap,
 * flush errors are swallowed, and an over-long queue drops oldest-first
 * rather than growing without bound.
 */

/** Mirrors the 0028 CHECK and Core's enum exactly. Closed by design. */
export type InsightEvent =
  | 'session_start' | 'session_heartbeat' | 'session_end' | 'nav_view'
  | 'page_view' | 'cta_click' | 'scroll_depth'
  | 'signup_start' | 'signup_submit' | 'signup_complete' | 'login_complete'
  | 'course_open' | 'lesson_start' | 'lesson_complete' | 'first_lesson_complete'
  | 'lesson_abandon' | 'segment_view' | 'segment_submit' | 'segment_retry'
  | 'hint_open' | 'explanation_view' | 'audio_replay' | 'results_view'
  | 'task_view'
  | 'profile_edit' | 'avatar_edit' | 'tutor_open'
  | 'streak_extend' | 'territory_view' | 'consent_grant' | 'consent_revoke';

export type InsightRouteClass =
  | 'learn'
  | 'tasks'
  | 'profile'
  | 'tutor'
  | 'family'
  | 'admin'
  | 'marketing'
  | 'other';

interface QueuedEvent {
  event: InsightEvent;
  routeClass?: InsightRouteClass;
  lessonId?: string;
  segmentId?: string;
  value?: number;
  sessionId?: string;
  device?: Device;
  locale?: 'en-US' | 'es-MX' | 'pt-BR';
  referrerClass?: ReferrerClass;
  ordinal?: number;
  /** Beacon-generated idempotency key, never caller supplied. */
  clientEventId?: string;
  eventVersion?: number;
  occurredAt?: string;
  courseId?: string;
}

type InsightFields = Omit<QueuedEvent, 'event' | 'clientEventId' | 'eventVersion' | 'occurredAt'>;

const MAX_QUEUE = 100;
const MAX_BATCH = 25;

/*
 * Per-visit identity + ambient dimensions. sessionId groups one visit's
 * events (it is NOT stable across visits — cross-visit identity is user_id
 * or the consented anon id, never this), and `ordinal` is the event's
 * position within the session, which is what makes funnels and
 * last-action-before-exit analysis cheap on the server.
 */
let sessionId: string | null = null;
let ordinal = 0;
let ambient: { device?: Device; locale?: 'en-US' | 'es-MX' | 'pt-BR'; referrerClass?: ReferrerClass } = {};
/** Anonymous (pre-signup) mode: identity is the first-party cookie. */
let anonMode = false;
let anonContext: VisitorContext | null = null;
let visitorRegistered = false;
/**
 * Which identity the current session belongs to. A visit that starts
 * anonymous on the marketing site and then signs in is TWO sessions, not one:
 * see the rotation in configureInsights().
 */
let identityMode: 'anon' | 'auth' | null = null;

function newSessionId(): string | null {
  return globalThis.crypto?.randomUUID?.() ?? null;
}

function newEventId(): string | undefined {
  return globalThis.crypto?.randomUUID?.();
}

/** Build the immutable transport envelope once, before a retry can happen. */
function stampEvent(event: InsightEvent, fields: InsightFields): QueuedEvent {
  return {
    event,
    ...fields,
    clientEventId: newEventId(),
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
  };
}

/** Ambient dimensions applied to every subsequent event. */
/**
 * Stamp device, locale and referrer onto every event this session emits.
 *
 * MUST be called for AUTHENTICATED sessions too, not only anonymous ones.
 * Until 2026-08-28 only `startAnonymousTracking` called it, so 93% of stored
 * events carried no device and no locale and 100% carried no referrer —
 * measured in production, and it meant the console could not answer "do
 * parents use a phone or a laptop" for the half of the product that is behind
 * a login. Every breakdown by device was silently computed on the anonymous
 * 7% while being labelled as the whole.
 *
 * `referrerClass` comes from the landing snapshot when there is one (so a
 * visitor who arrived from search and then signed in keeps `search` rather
 * than becoming `internal` at the moment they authenticate), and from a live
 * classification otherwise.
 */
export function setInsightsContext(ctx: { locale?: string }): void {
  const visitor = (() => {
    try {
      return collectVisitorContext(ctx.locale);
    } catch {
      // sessionStorage unavailable (Safari private mode): a missing referrer
      // is a worse answer than no answer, but it must never break tracking.
      return null;
    }
  })();
  ambient = {
    device: detectDevice(),
    locale:
      ctx.locale === 'en-US' || ctx.locale === 'es-MX' || ctx.locale === 'pt-BR' ? ctx.locale : undefined,
    referrerClass: visitor?.referrerClass,
  };
}

let queue: QueuedEvent[] = [];
let enabled = false;
/**
 * Events fired BEFORE the beacon knows whether it may run.
 *
 * On a direct load of a deep route (a bookmarked lesson), the page's own
 * mount effects fire before /auth/me has answered, so `enabled` is still
 * false and the events would simply be dropped — losing exactly the
 * lesson_start the drop-off analysis depends on. These are held in memory
 * and NEVER transmitted: configureInsights() either promotes them (allowed)
 * or discards them (not allowed), so the fail-closed contract is intact —
 * nothing leaves the browser before consent is known.
 */
let pending: QueuedEvent[] = [];
let configured = false;
/** session_start dedup across re-renders/StrictMode; cleared only on real teardown. */
let sessionAnnounced = false;
let tokenProvider: (() => Promise<string | null>) | null = null;
/** Last token a flush used — the pagehide path has no time to refresh one. */
let lastKnownToken: string | null = null;

/** Wire (or re-wire) the beacon to the current session. Disabling clears the queue. */
export function configureInsights(opts: {
  enabled: boolean;
  getToken: () => Promise<string | null>;
  /** Anonymous acquisition mode: identity is the first-party cookie, not a session. */
  anonymous?: boolean;
}): void {
  const nextMode: 'anon' | 'auth' = opts.anonymous === true ? 'anon' : 'auth';
  /*
   * ROTATE THE SESSION WHEN THE IDENTITY CHANGES.
   *
   * A visitor who browses the marketing site and then logs in used to keep
   * the same session_id across the transition, which produced two
   * session_start rows on one session — under two different identities, with
   * `ordinal` continuing from the anonymous half. Everything keyed on
   * session_id then read wrong: session counts, "events per session", and
   * last-action-before-exit all mixed an anonymous visit with a signed-in one.
   *
   * A change of who is acting IS a new session. Rotating the id (and resetting
   * ordinal and the announce latch) keeps each session single-identity, which
   * is what every session-grained view already assumes.
   */
  const identityChanged = enabled && identityMode !== null && identityMode !== nextMode;

  enabled = opts.enabled;
  tokenProvider = opts.getToken;
  anonMode = nextMode === 'anon';
  configured = true;

  if (enabled && (identityChanged || !sessionId)) {
    sessionId = newSessionId();
    ordinal = 0;
    sessionAnnounced = false;
  }
  if (enabled) identityMode = nextMode;
  if (!enabled) {
    queue = [];
    pending = [];
    return;
  }
  /*
   * Promote whatever mounted before we knew the answer — STAMPED. These rows
   * were buffered before sessionId, ordinal and the ambient dimensions
   * existed, and pushing them raw meant the events most worth having (the
   * lesson_start on a deep link is the whole reason the buffer exists) landed
   * with no session, no position and no device — invisible to every
   * session-grained view. They are stamped here, in arrival order, so a
   * promoted event is indistinguishable from one tracked a moment later.
   */
  if (pending.length > 0) {
    for (const e of pending) {
      ordinal += 1;
      queue.push({ ...ambient, sessionId: sessionId ?? undefined, ordinal, ...e });
    }
    pending = [];
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  }
}

/** Test/logout hygiene: forget everything, send nothing further. */
export function resetInsights(): void {
  enabled = false;
  configured = false;
  anonMode = false;
  identityMode = null;
  anonContext = null;
  visitorRegistered = false;
  tokenProvider = null;
  lastKnownToken = null;
  sessionAnnounced = false;
  sessionId = null;
  ordinal = 0;
  ambient = {};
  queue = [];
  pending = [];
}

/**
 * Start (or resume) anonymous acquisition tracking. No-op without cookie
 * consent — declining means no identity is minted and nothing is sent.
 */
export function startAnonymousTracking(locale?: string): boolean {
  if (!hasCookieConsent()) return false;
  const id = getAnonId();
  if (!id) return false;
  anonContext = collectVisitorContext(locale);
  setInsightsContext({ locale });
  configureInsights({ enabled: true, getToken: async () => null, anonymous: true });
  return true;
}

/**
 * Emit session_start exactly once per real session. The beacon effect
 * re-runs on dependency changes (token refresh, StrictMode probe mounts);
 * without this dedup every re-run inflated session counts.
 */
export function announceSessionStart(routeClass?: InsightRouteClass): void {
  if (!enabled || sessionAnnounced) return;
  sessionAnnounced = true;
  trackInsight('session_start', routeClass ? { routeClass } : {});
}

/** bfcache restore: allow the NEXT announce to open a fresh session. */
export function rebaseSessionStart(): void {
  sessionAnnounced = false;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function trackInsight(event: InsightEvent, fields: InsightFields = {}): void {
  if (configured && !enabled) return;
  // Clamp at the source: one out-of-range value must never be able to spoil
  // a batch (the server is per-event tolerant too — belt and braces).
  if (fields.value !== undefined) fields = { ...fields, value: Math.max(0, Math.min(86_400, Math.round(fields.value))) };
  if (fields.lessonId !== undefined && !UUID_RE.test(fields.lessonId)) {
    fields = { ...fields, lessonId: undefined };
  }
  // Not configured yet: hold, do not drop and do not send.
  if (!configured) {
    pending.push(stampEvent(event, fields));
    if (pending.length > MAX_BATCH) pending = pending.slice(-MAX_BATCH);
    return;
  }
  ordinal += 1;
  queue.push(stampEvent(event, {
    ...ambient,
    sessionId: sessionId ?? undefined,
    ordinal,
    ...fields,
  }));
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= MAX_BATCH) void flushInsights();
}

/** Send what is queued. Failures re-queue nothing — losing telemetry is fine. */
export async function flushInsights(): Promise<void> {
  if (!enabled || queue.length === 0) return;

  if (anonMode) {
    const anonId = getAnonId();
    if (!anonId) return; // consent withdrawn mid-session
    const batch = queue.splice(0, MAX_BATCH);
    const body: Record<string, unknown> = { events: batch, anonId };
    // Acquisition context travels once, with the first batch that registers
    // the visitor; afterwards the row already holds it. The flag is set only
    // AFTER the request succeeds — marking it sent up front meant a single
    // failed first flush (an offline moment on the landing page) permanently
    // discarded the campaign attribution for that visitor.
    const carriesVisitor = !visitorRegistered && anonContext !== null;
    if (carriesVisitor) body.visitor = anonContext;
    const { error } = await api('/events', { method: 'POST', body });
    if (carriesVisitor && !error) visitorRegistered = true;
    return;
  }

  if (!tokenProvider) return;
  const batch = queue.splice(0, MAX_BATCH);
  const token = await tokenProvider();
  if (!token) return;
  lastKnownToken = token;
  /*
   * The consented first-party visitor id rides along on authenticated batches
   * too. Core uses it for ONE thing — closing the loop from anonymous visitor
   * to the account it became, on signup_complete/login_complete — which is
   * what makes OAuth signups attributable at all (they never touch
   * /auth/signup). It is never written onto an authenticated event row.
   */
  const anonId = getAnonId() ?? undefined;
  await api('/events', { method: 'POST', body: { events: batch, anonId }, token });
}

/**
 * pagehide flush: the page is being torn down, so there is no time for the
 * async token refresh api() would do — use the last token a normal flush
 * used, with `keepalive` so the request survives the unload. Best effort by
 * design; a stale token just means the tail of the session is lost.
 */
export function flushInsightsOnHide(): void {
  if (!enabled || queue.length === 0) return;
  const anonId = anonMode ? getAnonId() : null;
  if (!anonMode && !lastKnownToken) return;
  if (anonMode && !anonId) return;
  const batch = queue.splice(0, MAX_BATCH);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!anonMode && lastKnownToken) headers.Authorization = `Bearer ${lastKnownToken}`;
  void fetch(`${BASE_URL}/api/v1/events`, {
    method: 'POST',
    keepalive: true,
    headers,
    body: JSON.stringify(anonMode ? { events: batch, anonId } : { events: batch }),
  }).catch(() => undefined);
}

/** Map a pathname to its closed route class (first path segment wins). */
export function classifyRoute(pathname: string): InsightRouteClass {
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  switch (first) {
    case 'learn': return 'learn';
    case 'tasks': return 'tasks';
    case 'profile': return 'profile';
    case 'tutor': return 'tutor';
    case 'family': return 'family';
    case 'admin': return 'admin';
    case '': return 'marketing';
    default: return 'other';
  }
}
