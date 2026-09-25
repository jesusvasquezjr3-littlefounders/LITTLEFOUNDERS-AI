import { BehavioralTelemetry } from '../../tutor/behavioralTelemetry.js';
import type { Locale } from '../../context/schema.js';
import { AUDIT_ITEMS, VARIANT_GROUPS, type AuditItem, type VariantGroup } from './fixtures.js';
import { AUDITED_COMPONENTS, componentHash, type AuditedComponent } from './registry.js';
import { SESSION_CASES, type SessionParityCase } from './sessions.js';

/*
 * C.20 — THE BIAS AUDIT (fixture-based, zero spend).
 *
 * For every registered component, every item and every variant:
 *
 *   ACCURACY       the standard form receives the item's expected label.
 *   PARITY         every other variant receives the same label as the
 *                  standard form. A variant read differently is differential
 *                  treatment by dialect or by speech-to-text quality, and it
 *                  fails the audit.
 *
 * Plus FUSED PARITY: the same learner behaviour rendered in each dialect must
 * lead the Behavioral Telemetry Layer to the same check-ins on the same turns.
 *
 * Per component × locale × group the report carries the agreement rate and
 * the false-positive / false-negative counts against the expected label, so
 * a reviewer sees WHERE a gap is, not only that one exists. Known gaps are
 * listed on every run with their reason and never count as a pass.
 *
 * Pure and deterministic: no network, no model, no clock (the report's date
 * is stamped by the CLI).
 */

/** Labels that mean "nothing detected" — used to split disagreements into FP and FN. */
const NEGATIVE_LABELS = new Set(['false', 'none', 'unclear', 'allowed', 'null']);

export interface VariantResult {
  group: VariantGroup;
  text: string;
  got: string;
  ok: boolean;
  knownGap: string | null;
}

export interface ItemResult {
  id: string;
  component: string;
  locale: Locale;
  expected: string;
  variants: VariantResult[];
}

export interface GroupStats {
  n: number;
  agree: number;
  falsePositive: number;
  falseNegative: number;
  knownGaps: number;
}

export interface ComponentReport {
  id: string;
  kind: AuditedComponent['kind'];
  feeds: AuditedComponent['feeds'];
  mode: AuditedComponent['mode'];
  sourceHash: string;
  items: number;
  variants: number;
  /** locale → group → stats. */
  byLocaleGroup: Record<string, Partial<Record<VariantGroup, GroupStats>>>;
  failures: { item: string; group: VariantGroup; text: string; expected: string; got: string; kind: 'accuracy' | 'parity' }[];
  knownGaps: { item: string; group: VariantGroup; reason: string }[];
}

export interface SessionParityResult {
  id: string;
  locale: Locale;
  /** group → the turns (1-based) on which a check-in fired. */
  checkIns: Partial<Record<VariantGroup, number[]>>;
  ok: boolean;
}

export interface BiasAuditReport {
  components: ComponentReport[];
  sessions: SessionParityResult[];
  totals: { components: number; fixtureComponents: number; items: number; variants: number; failures: number; knownGaps: number };
  ok: boolean;
}

const emptyStats = (): GroupStats => ({ n: 0, agree: 0, falsePositive: 0, falseNegative: 0, knownGaps: 0 });

function runItem(component: AuditedComponent, item: AuditItem): ItemResult {
  const context = item.context ?? '';
  const variants: VariantResult[] = [];
  for (const group of VARIANT_GROUPS) {
    const text = item.variants[group];
    if (text === undefined) continue;
    const got = component.run(text, item.locale, context);
    variants.push({ group, text, got, ok: got === item.expected, knownGap: item.knownGaps?.[group] ?? null });
  }
  return { id: item.id, component: item.component, locale: item.locale, expected: item.expected, variants };
}

export function auditComponent(component: AuditedComponent, items: readonly AuditItem[]): ComponentReport {
  const own = items.filter((i) => i.component === component.id);
  const report: ComponentReport = {
    id: component.id,
    kind: component.kind,
    feeds: component.feeds,
    mode: component.mode,
    sourceHash: componentHash(component),
    items: own.length,
    variants: 0,
    byLocaleGroup: {},
    failures: [],
    knownGaps: [],
  };
  if (component.mode === 'live_only') return report;
  for (const item of own) {
    const result = runItem(component, item);
    const standard = result.variants.find((v) => v.group === 'standard')!;
    for (const variant of result.variants) {
      report.variants += 1;
      const stats = ((report.byLocaleGroup[item.locale] ??= {})[variant.group] ??= emptyStats());
      stats.n += 1;
      if (variant.ok) stats.agree += 1;
      else if (NEGATIVE_LABELS.has(item.expected)) stats.falsePositive += 1;
      else stats.falseNegative += 1;
      if (variant.ok) continue;
      if (variant.knownGap !== null) {
        stats.knownGaps += 1;
        report.knownGaps.push({ item: item.id, group: variant.group, reason: variant.knownGap });
        continue;
      }
      report.failures.push({
        item: item.id,
        group: variant.group,
        text: variant.text,
        expected: item.expected,
        got: variant.got,
        // A standard form misread is an accuracy failure; a variant that
        // differs from a correctly read standard is differential treatment.
        kind: variant.group === 'standard' || !standard.ok ? 'accuracy' : 'parity',
      });
    }
  }
  return report;
}

/** Runs one parity case through a fresh telemetry layer per rendering. */
export function auditSession(parityCase: SessionParityCase): SessionParityResult {
  const groups = VARIANT_GROUPS.filter((g) => parityCase.turns.every((turn) => turn.text === null || turn.text[g] !== undefined));
  const checkIns: Partial<Record<VariantGroup, number[]>> = {};
  for (const group of groups) {
    const layer = new BehavioralTelemetry('act', parityCase.locale);
    const fired: number[] = [];
    parityCase.turns.forEach((turn, index) => {
      if (layer.checkInOpen) layer.recordCheckInReply('unanswered');
      const text = turn.text === null ? null : turn.text[group]!;
      layer.observe({
        source: turn.text === null ? 'activity' : 'typed',
        text,
        latencyMs: turn.latencyMs,
        graded: turn.graded ? { ...turn.graded, answer: text } : null,
        topicText: parityCase.context,
      });
      if (layer.checkInDue) {
        layer.markCheckInDelivered();
        fired.push(index + 1);
      }
    });
    checkIns[group] = fired;
  }
  const reference = JSON.stringify(checkIns.standard ?? []);
  const ok = groups.every((g) => JSON.stringify(checkIns[g]) === reference);
  return { id: parityCase.id, locale: parityCase.locale, checkIns, ok };
}

export function runBiasAudit(
  components: readonly AuditedComponent[] = AUDITED_COMPONENTS,
  items: readonly AuditItem[] = AUDIT_ITEMS,
  sessions: readonly SessionParityCase[] = SESSION_CASES,
): BiasAuditReport {
  const reports = components.map((c) => auditComponent(c, items));
  const sessionResults = sessions.map(auditSession);
  const failures = reports.reduce((n, r) => n + r.failures.length, 0);
  const knownGaps = reports.reduce((n, r) => n + r.knownGaps.length, 0);
  return {
    components: reports,
    sessions: sessionResults,
    totals: {
      components: components.length,
      fixtureComponents: components.filter((c) => c.mode === 'fixture').length,
      items: reports.reduce((n, r) => n + r.items, 0),
      variants: reports.reduce((n, r) => n + r.variants, 0),
      failures,
      knownGaps,
    },
    ok: failures === 0 && sessionResults.every((s) => s.ok) && reports.every((r) => r.mode === 'live_only' || r.items > 0),
  };
}
