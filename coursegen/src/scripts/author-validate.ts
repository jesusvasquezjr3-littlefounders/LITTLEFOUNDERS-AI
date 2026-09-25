/*
 * author-validate — the acceptance check for subagent-authored documents.
 *
 * This is the piece that makes an out-of-pipeline author SAFE. The subagent
 * replaces `plan`+`write`; it does NOT replace the contract or the gates, and
 * nothing downstream may assume a document is usable because an agent said it
 * was done. Every file goes through the same sequence `run.ts` applies to a
 * DeepSeek draft:
 *
 *   JSON.parse → stripNullValues → repairDocument → runAllGates (all 9)
 *
 * `runAllGates` returns the PARSED document, and the two sanitizers mutate the
 * raw object, so the canonical form is written back over the agent's file: the
 * bytes that get published are the bytes that passed, not a near-miss the
 * publisher re-parses differently.
 *
 * Failures are reported as ACTIONABLE feedback per slot (`report.json`), which
 * is how the corrective-retry loop is reconstituted: a failing brief is handed
 * back to a subagent together with its gate messages, exactly as write.ts feeds
 * `gateCtx` problems into its next attempt.
 *
 * Usage:
 *   npx tsx src/scripts/author-validate.ts --course <slug> --dir <briefs-dir>
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { loadCourseCatalog } from '../catalog/loader.js';
import { enumerateSlots, type Slot } from '../pipeline/run.js';
import { resolveRegister } from '../pipeline/register.js';
import { runAllGates, type GateContext, type GateProblem } from '../pipeline/gates.js';
import { stripNullValues, repairDocument } from '../pipeline/write.js';
import { blockingLessonFindings, buildCoursePolicy } from '../contentGates/policyGates.js';

interface ManifestEntry {
  slotId: string;
  brief: string;
  out: string;
  tier: string;
  contract: string;
}

interface SlotReport {
  slotId: string;
  brief: string;
  out: string;
  ok: boolean;
  problems: Array<{ gate: number; message: string; segmentId?: string }>;
  segments?: number;
}

function parseArgs(argv: string[]): { course: string; dir: string } {
  let course: string | undefined;
  let dir: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    const take = (name: string): string => {
      if (value === undefined || value.startsWith('--')) throw new Error(`author-validate: ${name} requires a value`);
      i++;
      return value;
    };
    if (argv[i] === '--course') course = take('--course');
    else if (argv[i] === '--dir') dir = take('--dir');
    else throw new Error(`author-validate: unknown flag "${argv[i]}"`);
  }
  if (!course || !dir) throw new Error('author-validate: --course and --dir are required');
  return { course, dir };
}

function describe(problems: GateProblem[]): SlotReport['problems'] {
  return problems.map((p) => ({ gate: p.gate, message: p.message, ...(p.segmentId ? { segmentId: p.segmentId } : {}) }));
}

function main(): void {
  const { course, dir } = parseArgs(process.argv.slice(2));
  const load = loadCourseCatalog(join('curriculum', course));
  const { taxonomy, facts } = load.course;
  if (!taxonomy || !facts) throw new Error('author-validate: course taxonomy/facts failed to load');

  const register = resolveRegister(taxonomy, 'kid');
  const slotsById = new Map<string, Slot>(enumerateSlots(load.course.adventures).map((s) => [s.slotId, s]));
  // Lesson-policy gates 14-16 (S05.4b): catalog declarations plus the per-lesson document checks.
  const coursePolicy = buildCoursePolicy(load.course, { register: register.register });

  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { slots: ManifestEntry[] };
  const reports: SlotReport[] = [];

  for (const entry of manifest.slots) {
    const slot = slotsById.get(entry.slotId);
    if (!slot) throw new Error(`author-validate: manifest slot "${entry.slotId}" is not in the catalog`);
    const path = join(dir, entry.out);
    const base: SlotReport = { slotId: entry.slotId, brief: entry.brief, out: entry.out, ok: false, problems: [] };

    if (!existsSync(path)) {
      reports.push({ ...base, problems: [{ gate: 0, message: 'no document was written for this slot' }] });
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      reports.push({
        ...base,
        problems: [{ gate: 0, message: `file is not valid JSON: ${err instanceof Error ? err.message : String(err)}` }],
      });
      continue;
    }

    // The exact sanitizer pair run.ts applies before it trusts a draft: a
    // literal `null` on an optional field means "omit", and a handful of
    // constraints (balance_scale subset sums, measure_read tick geometry,
    // savings_goal's computed key) are cheaper to normalise than to argue
    // about with the author. See write.ts for why each one exists.
    const sanitized = repairDocument(stripNullValues(raw));

    const gateCtx: GateContext = {
      taxonomy,
      tier: slot.tier,
      facts,
      topicTitle: slot.topic.title_es,
      skipVocabularyGate: !register.vocabularyGates,
      register: register.register,
      ...(coursePolicy.lessons.get(slot.lesson.slug) ? { lessonPolicy: coursePolicy.lessons.get(slot.lesson.slug) } : {}),
    };
    const report = runAllGates(sanitized, gateCtx);
    report.problems.push(...blockingLessonFindings(coursePolicy, slot.lesson.slug).map((f) => ({ gate: f.gate, message: `catalog (${f.spec}): ${f.message}` })));
    if (report.problems.length > 0) report.ok = false;

    const identity: SlotReport['problems'] = [];
    if (report.document) {
      // Identity is not a gate's job, but a document filed under the wrong
      // slug/locale publishes into the WRONG lesson row — silently, because
      // publish keys on the catalog slug, not on meta.
      if (report.document.meta.slug !== slot.lesson.slug) {
        identity.push({
          gate: 0,
          message: `meta.slug is "${report.document.meta.slug}" but this slot is "${slot.lesson.slug}" — they must match exactly`,
        });
      }
      if (report.document.meta.locale !== 'es-MX') {
        identity.push({ gate: 0, message: `meta.locale must be "es-MX" (authoring locale), got "${report.document.meta.locale}"` });
      }
    }

    const problems = [...describe(report.problems), ...identity];
    const ok = report.ok && identity.length === 0;
    if (ok && report.document) writeFileSync(path, `${JSON.stringify(report.document, null, 2)}\n`, 'utf8');

    reports.push({ ...base, ok, problems, ...(report.document ? { segments: report.document.segments.length } : {}) });
  }

  writeFileSync(join(dir, 'report.json'), `${JSON.stringify({ course, slots: reports }, null, 2)}\n`, 'utf8');

  const passed = reports.filter((r) => r.ok);
  const failed = reports.filter((r) => !r.ok);
  console.log(`author-validate: ${passed.length}/${reports.length} passed the contract + all 9 gates`);
  for (const r of failed) {
    console.log(`\n  FAIL ${r.slotId}`);
    for (const p of r.problems.slice(0, 8)) console.log(`    gate ${p.gate}${p.segmentId ? ` @ ${p.segmentId}` : ''}: ${p.message}`);
    if (r.problems.length > 8) console.log(`    … and ${r.problems.length - 8} more`);
  }
  // A non-zero exit is what stops a caller from publishing a partial course by
  // accident (mass-generation #4: every slot lands in exactly one bucket).
  if (failed.length > 0) process.exitCode = 1;
}

main();
