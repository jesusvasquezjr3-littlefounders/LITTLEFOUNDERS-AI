/*
 * Product C.24: THE MENTOR-QUALITY DASHBOARD, as staff read and act on it.
 *
 * Read side: the latest snapshot the evaluation loop stored, merged with the
 * signal registry (so a signal with no data yet still shows, as such), every
 * active flag with its owner role, the named owners and the weekly review
 * record. Freshness (Appendix F §1.4: every consolidated signal within 24
 * hours) and the owners' review completion are computed here, at read time,
 * so a loop that stopped running shows as stale rather than as calm.
 *
 * Write side, all audited in `audit_logs`:
 *   - a NAMED OWNER of the flag's role acknowledges it, then resolves it with
 *     the root cause in words (never a bare click; the machine never closes
 *     a flag);
 *   - a named owner signs the weekly review of their role's signals;
 *   - staff with `manage_users` name or remove an owner (the person must be
 *     staff who can read analytics);
 *   - a named owner records a per-release manual audit (B.25, B.22, B.20;
 *     GAP-FIX-R2) through `record_release_audit`, which re-checks the owner
 *     role in SQL and writes the audit row in the same transaction.
 * The route layer requires `view_analytics` before any of this runs; the
 * named-owner rule is enforced HERE, against the database, never by the UI.
 */

import { insertAuditLog, serviceRest } from '../supabaseRest.js';
import {
  freshness,
  isoWeekStart,
  OWNER_ROLES,
  RELEASE_AUDIT_KINDS,
  RELEASE_AUDIT_SIGNAL,
  RETIRED_SIGNALS,
  reviewCompletion,
  rubricSummary,
  SIGNALS,
  signalDefinition,
  MENTOR_QUALITY_THRESHOLDS as T,
  type OwnerRole,
  type ReleaseAuditKind,
  type SignalReading,
} from './mentorQuality.js';
import { TRANSCRIPT_RUBRIC_HASH, TRANSCRIPT_RUBRIC_VERSION } from './transcriptRubric.js';

export interface FlagRow {
  id: string;
  signal_id: string;
  kind: string;
  requirement: string;
  owner_role: OwnerRole;
  severity: 'review' | 'urgent';
  scope: string;
  metric_value: number | string | null;
  threshold: number | string | null;
  evidence: Record<string, unknown>;
  status: 'open' | 'acknowledged' | 'resolved';
  opened_at: string;
  last_seen_at: string;
  seen_count: number;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
}

const FLAG_COLUMNS =
  'id,signal_id,kind,requirement,owner_role,severity,scope,metric_value,threshold,evidence,status,opened_at,last_seen_at,seen_count,acknowledged_by,acknowledged_at,resolved_by,resolved_at,resolution_note';

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

function flagView(f: FlagRow) {
  return {
    id: f.id,
    signalId: f.signal_id,
    kind: f.kind,
    requirement: f.requirement,
    ownerRole: f.owner_role,
    severity: f.severity,
    scope: f.scope,
    value: num(f.metric_value),
    threshold: num(f.threshold),
    evidence: f.evidence,
    status: f.status,
    openedAt: f.opened_at,
    lastSeenAt: f.last_seen_at,
    seenCount: f.seen_count,
    acknowledgedAt: f.acknowledged_at,
    resolvedAt: f.resolved_at,
    resolutionNote: f.resolution_note,
  };
}

interface ReleaseAuditDbRow { audit_kind: ReleaseAuditKind; release_id: string; result: 'pass' | 'fail'; finding_count: number | string; recorded_at: string }

export async function getMentorQualityDashboard(now = new Date(), viewerId: string | null = null) {
  const previousWeek = isoWeekStart(new Date(now.getTime() - 7 * 86_400_000));
  const resolvedSince = encodeURIComponent(new Date(now.getTime() - 30 * 86_400_000).toISOString());
  const [snapshots, runs, active, resolved, owners, reviews, audits] = await Promise.all([
    serviceRest<{ id: string; computed_at: string; window_days: number; rubric_hash: string; signals: SignalReading[] }[]>(
      '/mentor_quality_snapshot?select=id,computed_at,window_days,rubric_hash,signals&order=computed_at.desc&limit=1',
    ),
    serviceRest<{ started_at: string; finished_at: string | null; status: string; scored: number; failed: number; backlog_before: number | null; trigger: string }[]>(
      '/tutor_evaluation_run?select=started_at,finished_at,status,scored,failed,backlog_before,trigger&order=started_at.desc&limit=1',
    ),
    serviceRest<FlagRow[]>(`/mentor_quality_flag?select=${FLAG_COLUMNS}&status=in.(open,acknowledged)&order=opened_at.desc&limit=500`),
    serviceRest<FlagRow[]>(`/mentor_quality_flag?select=${FLAG_COLUMNS}&status=eq.resolved&resolved_at=gte.${resolvedSince}&order=resolved_at.desc&limit=100`),
    serviceRest<{ owner_role: OwnerRole; user_id: string; assigned_at: string }[]>('/mentor_quality_owner?select=owner_role,user_id,assigned_at&order=assigned_at.asc'),
    serviceRest<{ owner_role: OwnerRole; reviewer_id: string | null; week_start: string; reviewed_at: string; open_flags: number }[]>(
      `/mentor_quality_review?select=owner_role,reviewer_id,week_start,reviewed_at,open_flags&week_start=gte.${previousWeek}&order=reviewed_at.desc`,
    ),
    serviceRest<ReleaseAuditDbRow[]>('/release_audit_results?select=audit_kind,release_id,result,finding_count,recorded_at&order=recorded_at.desc&limit=60'),
  ]);
  if (!Array.isArray(snapshots) || !Array.isArray(runs) || !Array.isArray(active) || !Array.isArray(resolved) || !Array.isArray(owners) || !Array.isArray(reviews)
    || !Array.isArray(audits)) {
    return null;
  }
  const ids = [...new Set(owners.map((o) => o.user_id))];
  const profiles = ids.length === 0
    ? []
    : await serviceRest<{ user_id: string; display_name: string }[]>(`/profiles?user_id=in.(${ids.join(',')})&select=user_id,display_name`);
  if (!Array.isArray(profiles)) return null;
  const nameOf = new Map(profiles.map((p) => [p.user_id, p.display_name]));

  const snapshot = snapshots[0] ?? null;
  const byId = new Map((snapshot?.signals ?? []).map((r) => [r.id, r]));
  const fresh = freshness(snapshot?.computed_at ?? null, now);
  const completion = reviewCompletion(owners, reviews, now);
  const urgent = (a: FlagRow, b: FlagRow) => (a.severity === b.severity ? b.opened_at.localeCompare(a.opened_at) : a.severity === 'urgent' ? -1 : 1);

  return {
    generatedAt: now.toISOString(),
    snapshot: snapshot === null
      ? null
      : { computedAt: snapshot.computed_at, windowDays: snapshot.window_days, rubricHash: snapshot.rubric_hash },
    freshness: { ...fresh, slaHours: T.freshnessHours },
    lastRun: runs[0]
      ? { startedAt: runs[0].started_at, status: runs[0].status, scored: runs[0].scored, failed: runs[0].failed, backlogBefore: runs[0].backlog_before, trigger: runs[0].trigger }
      : null,
    rubric: { version: TRANSCRIPT_RUBRIC_VERSION, hash: TRANSCRIPT_RUBRIC_HASH, criteria: rubricSummary() },
    signals: SIGNALS.map((def) => ({
      id: def.id,
      category: def.category,
      requirement: def.requirement,
      ownerRole: def.owner,
      threshold: def.threshold,
      source: def.source,
      pending: def.pending ?? null,
      instrumented: def.instrumented,
      // A signal the stored snapshot does not carry yet (a newer registry) is shown as not computed.
      reading: byId.get(def.id) ?? null,
      stale: fresh.stale,
    })),
    flags: {
      active: [...active].sort(urgent).map(flagView),
      recentlyResolved: resolved.map(flagView),
    },
    owners: owners.map((o) => ({ role: o.owner_role, userId: o.user_id, displayName: nameOf.get(o.user_id) ?? null, assignedAt: o.assigned_at })),
    // Which roles the reader is named for: the client shows actions only there (Core still enforces).
    viewerOwnerRoles: viewerId === null ? [] : OWNER_ROLES.filter((role) => owners.some((o) => o.owner_role === role && o.user_id === viewerId)),
    // GAP-FIX-R2 (Appendix C 1.2): the latest per-release audit of each kind, for the owner's form.
    releaseAudits: {
      cadenceDays: T.releaseAuditCadenceDays,
      kinds: RELEASE_AUDIT_KINDS.map((kind) => {
        const latest = audits.find((a) => a.audit_kind === kind) ?? null;
        return {
          kind,
          signalId: RELEASE_AUDIT_SIGNAL[kind],
          ownerRole: signalDefinition(RELEASE_AUDIT_SIGNAL[kind])!.owner,
          latest: latest === null ? null : {
            releaseId: latest.release_id, result: latest.result, findingCount: Number(latest.finding_count), recordedAt: latest.recorded_at,
          },
        };
      }),
    },
    // Signals taken off the registry, with the reason (never silently dropped).
    retiredSignals: RETIRED_SIGNALS,
    reviews: {
      ...completion,
      cadenceDays: T.reviewCadenceDays,
      thisWeek: reviews.filter((r) => r.week_start === completion.week).map((r) => ({ role: r.owner_role, reviewerId: r.reviewer_id, reviewedAt: r.reviewed_at, openFlags: r.open_flags })),
    },
  };
}

// ── Named owners ────────────────────────────────────────────────────────────

/** Whether `userId` is a named owner of `role` (null when the read failed). */
export async function isNamedOwner(userId: string, role: OwnerRole): Promise<boolean | null> {
  const rows = await serviceRest<{ user_id: string }[]>(`/mentor_quality_owner?select=user_id&owner_role=eq.${role}&user_id=eq.${userId}&limit=1`);
  if (!Array.isArray(rows)) return null;
  return rows.length === 1;
}

export type FlagActionResult = 'done' | 'not_found' | 'not_owner' | 'conflict' | 'unavailable';

async function loadFlag(flagId: string): Promise<FlagRow | null | undefined> {
  const rows = await serviceRest<FlagRow[]>(`/mentor_quality_flag?select=${FLAG_COLUMNS}&id=eq.${flagId}&limit=1`);
  if (!Array.isArray(rows)) return undefined;
  return rows[0] ?? null;
}

export async function acknowledgeFlag(flagId: string, actorId: string, now = new Date()): Promise<FlagActionResult> {
  const flag = await loadFlag(flagId);
  if (flag === undefined) return 'unavailable';
  if (flag === null) return 'not_found';
  const owner = await isNamedOwner(actorId, flag.owner_role);
  if (owner === null) return 'unavailable';
  if (!owner) return 'not_owner';
  const rows = await serviceRest<{ id: string }[]>(`/mentor_quality_flag?id=eq.${flagId}&status=eq.open`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'acknowledged', acknowledged_by: actorId, acknowledged_at: now.toISOString() }),
  });
  if (!Array.isArray(rows)) return 'unavailable';
  if (rows.length === 0) return 'conflict';
  await insertAuditLog(actorId, 'admin.mentor_quality.flag.acknowledge', flagId, { signal: flag.signal_id, kind: flag.kind, role: flag.owner_role });
  return 'done';
}

export const RESOLUTION_NOTE_MIN = 10;
export const RESOLUTION_NOTE_MAX = 2000;

export async function resolveFlag(flagId: string, actorId: string, note: string, now = new Date()): Promise<FlagActionResult> {
  const flag = await loadFlag(flagId);
  if (flag === undefined) return 'unavailable';
  if (flag === null) return 'not_found';
  const owner = await isNamedOwner(actorId, flag.owner_role);
  if (owner === null) return 'unavailable';
  if (!owner) return 'not_owner';
  const rows = await serviceRest<{ id: string }[]>(`/mentor_quality_flag?id=eq.${flagId}&status=in.(open,acknowledged)`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'resolved',
      resolved_by: actorId,
      resolved_at: now.toISOString(),
      resolution_note: note,
      // Resolving an unacknowledged flag acknowledges it in the same step.
      acknowledged_by: flag.acknowledged_by ?? actorId,
      acknowledged_at: flag.acknowledged_at ?? now.toISOString(),
    }),
  });
  if (!Array.isArray(rows)) return 'unavailable';
  if (rows.length === 0) return 'conflict';
  await insertAuditLog(actorId, 'admin.mentor_quality.flag.resolve', flagId, { signal: flag.signal_id, kind: flag.kind, role: flag.owner_role });
  return 'done';
}

export type ReviewResult = { ok: true; week: string } | { ok: false; code: 'not_owner' | 'already' | 'unavailable' };

/** The weekly sign-off (Appendix F §1.4 Dashboard Usage Rate): one per owner, role and ISO week. */
export async function recordOwnerReview(actorId: string, role: OwnerRole, note: string | null, now = new Date()): Promise<ReviewResult> {
  const owner = await isNamedOwner(actorId, role);
  if (owner === null) return { ok: false, code: 'unavailable' };
  if (!owner) return { ok: false, code: 'not_owner' };
  const week = isoWeekStart(now);
  const [snapshot, open] = await Promise.all([
    serviceRest<{ id: string }[]>('/mentor_quality_snapshot?select=id&order=computed_at.desc&limit=1'),
    serviceRest<{ id: string }[]>(`/mentor_quality_flag?select=id&owner_role=eq.${role}&status=in.(open,acknowledged)&limit=1000`),
  ]);
  if (!Array.isArray(snapshot) || !Array.isArray(open)) return { ok: false, code: 'unavailable' };
  const existing = await serviceRest<{ id: string }[]>(`/mentor_quality_review?select=id&owner_role=eq.${role}&reviewer_id=eq.${actorId}&week_start=eq.${week}&limit=1`);
  if (!Array.isArray(existing)) return { ok: false, code: 'unavailable' };
  if (existing.length > 0) return { ok: false, code: 'already' };
  const inserted = await serviceRest<unknown>('/mentor_quality_review', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      owner_role: role,
      reviewer_id: actorId,
      week_start: week,
      snapshot_id: snapshot[0]?.id ?? null,
      open_flags: open.length,
      note,
      reviewed_at: now.toISOString(),
    }),
  });
  if (inserted === null) return { ok: false, code: 'unavailable' };
  await insertAuditLog(actorId, 'admin.mentor_quality.review', role, { week, openFlags: open.length });
  return { ok: true, week };
}

export type OwnerChangeResult = 'done' | 'not_staff' | 'unchanged' | 'unavailable';

/** A named owner must be staff who can read this dashboard (admin with view_analytics, or superadmin). */
export async function canOwn(userId: string): Promise<boolean | null> {
  const [roles, grants] = await Promise.all([
    serviceRest<{ role: string }[]>(`/user_roles?select=role&user_id=eq.${userId}`),
    serviceRest<{ permission: string }[]>(`/admin_permissions?select=permission&user_id=eq.${userId}`),
  ]);
  if (!Array.isArray(roles) || !Array.isArray(grants)) return null;
  const r = roles.map((x) => x.role);
  if (r.includes('superadmin')) return true;
  return r.includes('admin') && grants.some((g) => g.permission === 'view_analytics');
}

export async function setOwner(input: { role: OwnerRole; userId: string; action: 'add' | 'remove'; actorId: string }): Promise<OwnerChangeResult> {
  if (input.action === 'add') {
    const allowed = await canOwn(input.userId);
    if (allowed === null) return 'unavailable';
    if (!allowed) return 'not_staff';
    const rows = await serviceRest<unknown[]>('/mentor_quality_owner?on_conflict=owner_role,user_id', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
      body: JSON.stringify({ owner_role: input.role, user_id: input.userId, assigned_by: input.actorId }),
    });
    if (!Array.isArray(rows)) return 'unavailable';
    if (rows.length === 0) return 'unchanged';
  } else {
    const rows = await serviceRest<unknown[]>(`/mentor_quality_owner?owner_role=eq.${input.role}&user_id=eq.${input.userId}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    });
    if (!Array.isArray(rows)) return 'unavailable';
    if (rows.length === 0) return 'unchanged';
  }
  await insertAuditLog(input.actorId, `admin.mentor_quality.owner.${input.action}`, input.userId, { role: input.role });
  return 'done';
}

export { OWNER_ROLES };

// ── Per-release manual audits (Appendix C 1.2; B.25, B.22, B.20) ─────────────

export type ReleaseAuditResult = 'recorded' | 'not_owner' | 'duplicate' | 'invalid' | 'unavailable';

/** Vault checks the named owner of the kind's role and writes the result and its audit row together. */
export async function recordReleaseAudit(input: {
  actorId: string; kind: ReleaseAuditKind; releaseId: string; result: 'pass' | 'fail'; findingCount: number; note: string | null;
}): Promise<ReleaseAuditResult> {
  const answer = await serviceRest<unknown>('/rpc/record_release_audit', {
    method: 'POST',
    body: JSON.stringify({
      p_actor: input.actorId, p_kind: input.kind, p_release_id: input.releaseId, p_result: input.result,
      p_findings: input.findingCount, p_note: input.note,
    }),
  });
  return answer === 'recorded' || answer === 'not_owner' || answer === 'duplicate' || answer === 'invalid' ? answer : 'unavailable';
}
