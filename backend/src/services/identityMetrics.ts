import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import { listMinorRecordTutors } from './tutorAgeRecord.js';

/*
 * Appendix M Part 1 (1.1-1.4), Part 2.1 criterion 3 ("Measured") and Part 3
 * Stage 5 (a change ships with its metric already instrumented): the Block A
 * acquisition and identity metrics, read from public.identity_metrics
 * (migration identity_metrics), which returns COUNTS for one window. This
 * module turns them into rates and marks each one either as a RELEASE-GATE
 * target (a fixed target the release is held to) or DIAGNOSTIC (a baseline
 * and a trend, no fixed target), exactly as Appendix M's Target column says.
 *
 * The adversarial metrics of the same tables (Flagged-Session Microphone
 * Suppression, AI Mentor Fail-Closed, Unconsented Analytics, Age-Screen
 * Bypass, Unauthorized Kid Email Change) are test suites, not data: they are
 * listed with the suite that proves them, never given a fabricated rate.
 *
 * Counts only: no account id reaches the console. A malformed or missing
 * answer fails the whole read (§1.14), never renders zeros.
 */

export type MetricKind = 'release_gate' | 'diagnostic';
export type MetricStatus = 'met' | 'missed' | 'no_data' | 'diagnostic';

export interface IdentityMetric {
  id: string;
  /** Appendix M part: 1.1 | 1.2 | 1.3 | 1.4. */
  part: '1.1' | '1.2' | '1.3' | '1.4';
  requirement: string;
  kind: MetricKind;
  /** The release-gate target as a rate (1 = 100%), or null for a diagnostic. */
  target: number | null;
  numerator: number;
  denominator: number;
  value: number | null;
  status: MetricStatus;
  /** Extra closed-vocabulary counts for the reader. */
  detail: Record<string, number | boolean>;
}

export interface IdentityMetricsReport {
  window: { from: string; to: string; days: number; backlogCutoff: string };
  metrics: IdentityMetric[];
  /** Appendix M adversarial metrics: proven by a test suite every release, never a rate. */
  adversarial: { id: string; requirement: string; suite: string }[];
  releaseGate: { total: number; met: number; missed: number; noData: number };
}

const n = z.coerce.number().int().nonnegative();
const created = z.object({ created: n, captured: n });
const Counts = z.object({
  window: z.object({ from: z.string(), to: z.string(), backlogCutoff: z.string() }),
  guestOrigin: z.object({ requested: n, flagged: n, flaggedGuestsCreated: n }),
  flagPersistence: z.object({ upgraded: n, safeguarded: n }),
  googleAgeScreen: z.object({ firstTime: n, screened: n }),
  googleUnder13: z.object({ declaredUnder13: n, reclassified: n }),
  entryCapture: z.object({
    email: created,
    google: created,
    guest: created,
    kid: created,
  }),
  undatedBacklog: z.object({ existing: n, undated: n }),
  parentTags: z.object({ holders: n, idVerified: n, staffGranted: n, revoked: n, untagged: n }),
  staffGrantJustification: z.object({ staffGranted: n, justified: n, justificationsInWindow: n }),
  revocation: z.object({ revokedRows: n, revokedInWindow: n, auditedRevocations: n }),
  kidEmail: z.object({ kids: n, restricted: n, refusalsInWindow: n }),
  faqCapabilities: z.object({ secondGuardian: z.boolean(), cancellationCascade: z.boolean(), reportTool: z.boolean() }),
  schemaFields: z.object({
    originFlag: z.object({ produced: n, consumed: z.boolean() }),
    verificationTier: z.object({ produced: n, consumed: z.boolean() }),
    documentType: z.object({ declared: z.boolean(), consumed: z.boolean() }),
    revocationStatus: z.object({ produced: n, consumed: z.boolean() }),
  }),
});
export type IdentityCounts = z.infer<typeof Counts>;

/** public.onboarding_discovery_metrics (migration onboarding_discovery_metrics): whole-population counts. */
const DiscoveryCounts = z.object({
  answered: n, unconsented: n, flaggedOrigin: n, kid: n, under13Declared: n, teenWithoutOptIn: n,
});
export type OnboardingDiscoveryCounts = z.infer<typeof DiscoveryCounts>;

export const IDENTITY_ADVERSARIAL = [
  { id: 'flagged_session_microphone', requirement: 'A.2', suite: 'backend/src/__tests__/tutor.test.ts (flagged-origin session: microphone POLICY_BLOCKED)' },
  { id: 'flagged_session_fail_closed', requirement: 'A.2', suite: 'backend/src/__tests__/tutor.test.ts (flagged-origin session treated as a minor in every Oracle preflight)' },
  { id: 'flagged_session_unconsented_analytics', requirement: 'A.2', suite: 'backend/src/__tests__/ageUpgradeChain.test.ts and database/scripts/verify-origin-postgres.py' },
  { id: 'age_screen_bypass', requirement: 'A.3', suite: 'backend/src/__tests__/ageScreen.test.ts' },
  { id: 'kid_email_change_unauthorized', requirement: 'A.6', suite: 'backend/src/__tests__/verificationAdmin.test.ts (KID_EMAIL_FORBIDDEN)' },
] as const;

function metric(
  id: string,
  part: IdentityMetric['part'],
  requirement: string,
  kind: MetricKind,
  numerator: number,
  denominator: number,
  detail: IdentityMetric['detail'] = {},
): IdentityMetric {
  const value = denominator === 0 ? null : numerator / denominator;
  const target = kind === 'release_gate' ? 1 : null;
  const status: MetricStatus = kind === 'diagnostic' ? 'diagnostic' : value === null ? 'no_data' : value >= 1 ? 'met' : 'missed';
  return { id, part, requirement, kind, target, numerator, denominator, value, status, detail };
}

/** Pure: the report for one set of counts. */
export function buildIdentityReport(
  c: IdentityCounts,
  days: number,
  discovery: OnboardingDiscoveryCounts,
  /** Tutors (parent role) whose own age record says a minor: public.list_minor_record_tutors. */
  minorRecordTutors = 0,
): IdentityMetricsReport {
  const entry = c.entryCapture;
  const newCreated = entry.email.created + entry.google.created + entry.guest.created;
  const newCaptured = entry.email.captured + entry.google.captured + entry.guest.captured;
  const tags = c.parentTags;
  const faq = [c.faqCapabilities.secondGuardian, c.faqCapabilities.cancellationCascade, c.faqCapabilities.reportTool];
  const fields = c.schemaFields;
  const fieldChecks = [
    fields.originFlag.produced > 0 && fields.originFlag.consumed,
    fields.verificationTier.produced > 0 && fields.verificationTier.consumed,
    // The alternate remedy (Appendix M 1.2): a document-type field kept only
    // when something validates it; a declared field with no consumer fails.
    !fields.documentType.declared || fields.documentType.consumed,
    fields.revocationStatus.consumed,
  ];
  const metrics: IdentityMetric[] = [
    metric('guest_origin_flag_coverage', '1.1', 'A.2', 'release_gate', c.guestOrigin.flagged, c.guestOrigin.requested,
      { flaggedGuestsCreated: c.guestOrigin.flaggedGuestsCreated }),
    // A.2, Appendix M 1.1 Unconsented Analytics Event Rate (target zero): a
    // stored onboarding discovery answer from a population the attribution
    // predicate refuses. Expressed as the share of stored answers that are
    // admitted, so "met" means zero unconsented rows.
    metric('onboarding_discovery_unconsented', '1.1', 'A.2', 'release_gate', discovery.answered - discovery.unconsented,
      discovery.answered, {
        unconsented: discovery.unconsented, flaggedOrigin: discovery.flaggedOrigin, kid: discovery.kid,
        under13Declared: discovery.under13Declared, teenWithoutOptIn: discovery.teenWithoutOptIn,
      }),
    metric('flag_persistence_through_upgrade', '1.1', 'A.2', 'release_gate', c.flagPersistence.safeguarded, c.flagPersistence.upgraded),
    metric('post_callback_age_screen_completion', '1.1', 'A.3', 'release_gate', c.googleAgeScreen.screened, c.googleAgeScreen.firstTime),
    metric('under13_google_reclassification', '1.1', 'A.3', 'release_gate', c.googleUnder13.reclassified, c.googleUnder13.declaredUnder13),
    metric('entry_path_age_capture', '1.1', 'A.4', 'release_gate', newCaptured, newCreated, {
      emailCreated: entry.email.created, emailCaptured: entry.email.captured,
      googleCreated: entry.google.created, googleCaptured: entry.google.captured,
      guestCreated: entry.guest.created, guestCaptured: entry.guest.captured,
      kidCreated: entry.kid.created, kidCaptured: entry.kid.captured,
    }),
    metric('undated_account_backlog', '1.1', 'A.4', 'diagnostic', c.undatedBacklog.undated, c.undatedBacklog.existing),
    metric('verification_status_differentiation', '1.2', 'A.5', 'release_gate', tags.holders - tags.untagged, tags.holders, {
      idVerified: tags.idVerified, staffGranted: tags.staffGranted, revoked: tags.revoked, untagged: tags.untagged,
    }),
    // A.2, A.5, OD-3 section 2 (F3-identity-site): every Tutor's own age
    // record is an adult's. A holder whose record says a minor (verified
    // before guard_parent_verification_age existed) misses the gate until
    // staff revoke the role or settle an E.4 age correction.
    metric('tutor_adult_age_record', '1.2', 'A.2, A.5', 'release_gate', Math.max(0, tags.holders - minorRecordTutors), tags.holders,
      { minorRecord: minorRecordTutors }),
    metric('staff_grant_justification_completeness', '1.2', 'A.5', 'release_gate', c.staffGrantJustification.justified,
      c.staffGrantJustification.staffGranted, { justificationsInWindow: c.staffGrantJustification.justificationsInWindow }),
    metric('revocation_path_utilization', '1.2', 'A.5', 'diagnostic', c.revocation.auditedRevocations, c.revocation.revokedRows, {
      revokedInWindow: c.revocation.revokedInWindow, pathExercised: c.revocation.revokedRows > 0,
    }),
    metric('kid_email_change_restriction', '1.3', 'A.6', 'release_gate', c.kidEmail.restricted, c.kidEmail.kids,
      { refusalsInWindow: c.kidEmail.refusalsInWindow }),
    metric('faq_claim_parity', '1.4', 'A.1', 'release_gate', faq.filter(Boolean).length, faq.length, {
      secondGuardian: c.faqCapabilities.secondGuardian, cancellationCascade: c.faqCapabilities.cancellationCascade,
      reportTool: c.faqCapabilities.reportTool,
    }),
    metric('schema_field_utilization', '1.4', 'A.2, A.5', 'release_gate', fieldChecks.filter(Boolean).length, fieldChecks.length, {
      originFlagProduced: fields.originFlag.produced, originFlagConsumed: fields.originFlag.consumed,
      verificationTierProduced: fields.verificationTier.produced, verificationTierConsumed: fields.verificationTier.consumed,
      documentTypeDeclared: fields.documentType.declared, documentTypeConsumed: fields.documentType.consumed,
      revocationProduced: fields.revocationStatus.produced, revocationConsumed: fields.revocationStatus.consumed,
    }),
  ];
  const gates = metrics.filter((m) => m.kind === 'release_gate');
  return {
    window: { from: c.window.from, to: c.window.to, days, backlogCutoff: c.window.backlogCutoff },
    metrics,
    adversarial: IDENTITY_ADVERSARIAL.map((a) => ({ ...a })),
    releaseGate: {
      total: gates.length,
      met: gates.filter((m) => m.status === 'met').length,
      missed: gates.filter((m) => m.status === 'missed').length,
      noData: gates.filter((m) => m.status === 'no_data').length,
    },
  };
}

export async function getIdentityMetrics(days: number, now: Date = new Date()): Promise<IdentityMetricsReport | null> {
  const from = new Date(now.getTime() - days * 86_400_000).toISOString();
  const [raw, rawDiscovery, minorRecord] = await Promise.all([
    serviceRest<unknown>('/rpc/identity_metrics', {
      method: 'POST',
      body: JSON.stringify({ p_from: from, p_to: now.toISOString() }),
    }),
    serviceRest<unknown>('/rpc/onboarding_discovery_metrics', { method: 'POST', body: '{}' }),
    listMinorRecordTutors(),
  ]);
  const parsed = Counts.safeParse(raw);
  const discovery = DiscoveryCounts.safeParse(rawDiscovery);
  return parsed.success && discovery.success && minorRecord
    ? buildIdentityReport(parsed.data, days, discovery.data, minorRecord.size)
    : null;
}
