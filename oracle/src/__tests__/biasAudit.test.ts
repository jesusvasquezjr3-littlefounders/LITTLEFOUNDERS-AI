import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditComponent, auditSession, runBiasAudit } from '../safety/biasAudit/audit.js';
import {
  CADENCE_DAYS,
  changedSinceAudit,
  checkProblems,
  coverage,
  entryFor,
  latestEntry,
  readAuditLog,
} from '../safety/biasAudit/auditLog.js';
import { AUDIT_ITEMS, JUDGE_ITEMS, VARIANT_GROUPS } from '../safety/biasAudit/fixtures.js';
import { AUDITED_COMPONENTS, REPO_ROOT, type AuditedComponent } from '../safety/biasAudit/registry.js';
import { SESSION_CASES } from '../safety/biasAudit/sessions.js';
import { isHedging } from '../tutor/telemetryLexicon.js';
import { LOCALES } from '../context/schema.js';

/*
 * C.20 — the dialect / accent / ASR-artifact bias audit, run on every Oracle
 * CI run. Fixture-based and free (no model, no network). A variant of a
 * meaning treated differently from its standard form fails the build, and a
 * component that changed since its last recorded audit fails it too.
 */

describe('the bias audit on the real components', () => {
  const report = runBiasAudit();

  it('every fixture component reads every dialect, code-switch, child-spelling and ASR variant like the standard form', () => {
    const failures = report.components.flatMap((c) =>
      c.failures.map((f) => `${f.kind} ${f.item} [${f.group}] "${f.text}": expected ${f.expected}, got ${f.got}`),
    );
    expect(failures).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('the same behaviour in each dialect leads the telemetry layer to the same check-ins on the same turns', () => {
    for (const session of report.sessions) {
      const renderings = Object.values(session.checkIns);
      expect(renderings.length, session.id).toBeGreaterThanOrEqual(4);
      expect(session.ok, JSON.stringify(session)).toBe(true);
    }
    // The cases are not vacuous: some must check in and some must not.
    expect(report.sessions.some((s) => (s.checkIns.standard ?? []).length > 0)).toBe(true);
    expect(report.sessions.some((s) => (s.checkIns.standard ?? []).length === 0)).toBe(true);
  });

  it('pins the known gaps: each has a reason, and a new one is a deliberate, reviewed decision', () => {
    const gaps = report.components.flatMap((c) => c.knownGaps);
    expect(gaps.map((g) => `${g.item}[${g.group}]`)).toEqual(['moderation.input_classifier:es-MX:benign-slang[vernacular]']);
    for (const gap of gaps) expect(gap.reason.length).toBeGreaterThan(40);
  });

  it('covers every registered fixture component in all three locales, with every variant group somewhere', () => {
    for (const component of AUDITED_COMPONENTS) {
      const items = component.mode === 'fixture' ? AUDIT_ITEMS : JUDGE_ITEMS;
      const own = items.filter((i) => i.component === component.id);
      expect(own.length, component.id).toBeGreaterThan(0);
      expect(new Set(own.map((i) => i.locale)), component.id).toEqual(new Set(LOCALES));
      for (const group of VARIANT_GROUPS) {
        expect(own.some((i) => i.variants[group] !== undefined), `${component.id} ${group}`).toBe(true);
      }
    }
    // Every item names a registered component: no orphan fixtures.
    const ids = new Set(AUDITED_COMPONENTS.map((c) => c.id));
    for (const item of [...AUDIT_ITEMS, ...JUDGE_ITEMS]) expect(ids.has(item.component), item.id).toBe(true);
    expect(new Set([...AUDIT_ITEMS, ...JUDGE_ITEMS].map((i) => i.id)).size).toBe(AUDIT_ITEMS.length + JUDGE_ITEMS.length);
  });

  it('never calls the paid model judge (OD-23): its fixture run throws and the audit still passes', () => {
    const judge = AUDITED_COMPONENTS.find((c) => c.id === 'moderation.output_judge')!;
    expect(judge.mode).toBe('live_only');
    expect(() => judge.run('x', 'en-US', '')).toThrow(/live-only/);
    expect(report.components.find((c) => c.id === judge.id)!.variants).toBe(0);
  });
});

describe('registry completeness: nothing that reads a learner’s words escapes the audit', () => {
  const registered = new Set(AUDITED_COMPONENTS.flatMap((c) => c.functions));
  const read = (file: string) => readFileSync(path.join(REPO_ROOT, file), 'utf8');
  const importsFrom = (file: string, module: string): string[] => {
    const match = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'${module.replace(/[.]/g, '\\.')}'`).exec(read(file));
    return match === null
      ? []
      : match[1]!
          .split(',')
          .map((s) => s.trim().replace(/^type\s+/, ''))
          .filter((s) => s !== '' && /^[a-z]/.test(s));
  };

  it('every lexical function the Behavioral Telemetry Layer imports is registered', () => {
    const used = [
      ...importsFrom('oracle/src/tutor/behavioralTelemetry.ts', './telemetryLexicon.js'),
      ...importsFrom('oracle/src/tutor/behavioralTelemetry.ts', './hintLadder.js'),
    ];
    expect(used.length).toBeGreaterThan(4);
    for (const fn of used) expect(registered.has(fn), `${fn} feeds C.9 but is not in the bias-audit registry`).toBe(true);
  });

  it('every learner-text classifier the orchestrator routes on is registered', () => {
    for (const [module, names] of [
      ['./telemetryLexicon.js', ['classifyCheckInReply']],
      ['./sessionEndSignal.js', ['classifyStopReply']],
      ['./hintLadder.js', ['isHintRequest', 'isTellRequest']],
    ] as const) {
      const imported = importsFrom('oracle/src/tutor/orchestrator.ts', module);
      for (const name of names) {
        expect(imported, `${name} from ${module}`).toContain(name);
        expect(registered.has(name), name).toBe(true);
      }
    }
    expect(registered.has('classifyLearnerInput')).toBe(true);
    expect(registered.has('deterministicModeration')).toBe(true);
  });

  it('every registered function exists as an export of one of its component’s sources', () => {
    for (const component of AUDITED_COMPONENTS) {
      const text = component.sources.map(read).join('\n');
      for (const fn of component.functions) {
        expect(text, `${component.id}: ${fn}`).toMatch(new RegExp(`export (?:async )?function ${fn}\\b`));
      }
    }
  });

  it('no prosodic component exists yet; the first one must be registered before it may feed anything', () => {
    expect(AUDITED_COMPONENTS.filter((c) => c.kind === 'prosodic')).toEqual([]);
    // The voice path is transcription only: no pitch/energy/rate feature is computed.
    const provider = read('oracle/src/voice/provider.ts');
    expect(provider).not.toMatch(/\b(pitch|prosod|energy|speakingRate|f0)\b/i);
  });
});

describe('the audit can fail (a gate that cannot turn red is decoration)', () => {
  const hedging = AUDITED_COMPONENTS.find((c) => c.id === 'telemetry.hedging')!;

  it('a detector that misses the vernacular form of a meaning is a PARITY failure', () => {
    const biased: AuditedComponent = {
      ...hedging,
      run: (text, locale) => String(isHedging(text, locale) && !/\bion\b|\bdunno\b|\bnose\b|\bsla\b/i.test(text)),
    };
    const result = auditComponent(biased, AUDIT_ITEMS);
    expect(result.failures.some((f) => f.kind === 'parity')).toBe(true);
    expect(runBiasAudit([biased], AUDIT_ITEMS, []).ok).toBe(false);
  });

  it('a detector that misreads the standard form is an ACCURACY failure', () => {
    const broken: AuditedComponent = { ...hedging, run: () => 'false' };
    expect(auditComponent(broken, AUDIT_ITEMS).failures.some((f) => f.kind === 'accuracy')).toBe(true);
  });

  it('a registered component with no fixtures fails the audit (no silent zero coverage)', () => {
    const orphan: AuditedComponent = { ...hedging, id: 'telemetry.unaudited' };
    expect(runBiasAudit([orphan], AUDIT_ITEMS, []).ok).toBe(false);
  });

  it('a session case whose renderings lead to different check-ins fails fused parity', () => {
    const base = SESSION_CASES.find((c) => c.id === 'es-MX:frustrated')!;
    // A "vernacular" rendering that is really a different, engaged learner.
    const skewed = {
      ...base,
      id: 'skewed',
      turns: base.turns.map((turn) =>
        turn.text === null
          ? turn
          : { ...turn, text: { ...turn.text, vernacular: 'Quiero ahorrar cinco pesos cada semana para la bici nueva' } },
      ),
    };
    expect(auditSession(skewed).ok).toBe(false);
  });
});

describe('the audit tracking log: material change and cadence', () => {
  const entries = readAuditLog();
  const latest = latestEntry(entries);

  it('an audit has been recorded, it passed, and it names every registered component', () => {
    expect(latest).not.toBeNull();
    expect(latest!.totals.failures).toBe(0);
    for (const component of AUDITED_COMPONENTS) expect(latest!.components[component.id], component.id).toBeDefined();
  });

  it('no audited component changed since its last recorded audit (rerun: npm run bias-audit -- --record)', () => {
    expect(changedSinceAudit(latest)).toEqual([]);
  });

  it('Bias-Audit Coverage counts the live-only judge as NOT covered until its live run', () => {
    const fixtureShare = AUDITED_COMPONENTS.filter((c) => c.mode === 'fixture').length / AUDITED_COMPONENTS.length;
    expect(coverage(latest)).toBeCloseTo(fixtureShare);
    expect(coverage(latest)).toBeLessThan(1);
  });

  it('--check fails on a stale audit, a changed component or a failing run; passes on a fresh, matching one', () => {
    const report = runBiasAudit();
    const recordedAt = new Date(`${latest!.date}T12:00:00Z`);
    expect(checkProblems(report, entries, recordedAt)).toEqual([]);
    const overdue = new Date(recordedAt.getTime() + (CADENCE_DAYS + 2) * 86_400_000);
    expect(checkProblems(report, entries, overdue).join('\n')).toMatch(/days old/);
    const tampered = [{ ...latest!, components: { ...latest!.components, 'telemetry.hedging': { hash: 'x', status: 'passed' as const } } }];
    expect(checkProblems(report, tampered, recordedAt).join('\n')).toMatch(/telemetry\.hedging changed/);
    expect(checkProblems({ ...report, ok: false }, entries, recordedAt).join('\n')).toMatch(/audit fails/);
  });

  it('refuses to record a failing audit', () => {
    const report = runBiasAudit();
    expect(() => entryFor({ ...report, ok: false }, '2026-09-25', 'initial', '')).toThrow(/refusing/);
    expect(entryFor(report, '2026-09-25', 'initial', '').reviewedBy).toBeNull();
  });
});
