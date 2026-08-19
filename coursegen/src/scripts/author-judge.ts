/*
 * author-judge — the independent quality judge, for subagent reviewers.
 *
 * WHY IT EXISTS. The 9 gates enforce CORRECTNESS: a document that clears them
 * is valid, solvable and arithmetically sound. They cannot tell you it is
 * BORING. That is what the judge is for — the 2026-07-23 manual QA found
 * exercises "mecánicamente válidos pero estúpidos, no aportan valor", and
 * `review.ts` exists because of it. Skipping the judge to save calls is how a
 * catalog of technically-perfect, unengaging lessons ships.
 *
 * The rubric, the calibrations and the PASS FLOORS are the pipeline's own:
 * `judgeSystemPrompt()`, `reviewRubricSchema`, `failingDimensions()`. The
 * reviewer subagent is given the same words the Qwen judge gets, and the
 * verdict is decided HERE, in code, by the same document-aware floors — never
 * by the agent's own opinion of whether it passed.
 *
 *   emit   → writes one judge brief per validated slot
 *   ingest → reads the verdicts, applies the floors, lists what must be revised
 *
 * A judge score is a DEFECT FINDER, not a metric. Measured 2026-07-24: rerunning
 * the same review on byte-identical lessons moved means by ±0.4 and flipped 10
 * lessons' solvability verdict with no content change. So `ingest` reports the
 * failing DIMENSIONS and the actionable notes; it deliberately does not print a
 * mean, and nothing should ever gate on one.
 *
 * Usage:
 *   npx tsx src/scripts/author-judge.ts emit   --course <slug> --dir <d>
 *   npx tsx src/scripts/author-judge.ts ingest --course <slug> --dir <d>
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { loadCourseCatalog } from '../catalog/loader.js';
import { buildCompetencyGraph, getCompetencyPromptContext } from '../catalog/competencyGraph.js';
import { enumerateSlots, type Slot } from '../pipeline/run.js';
import { lessonDocumentSchema } from '../contract/schema.js';
import { judgeSystemPrompt, judgePriorLine, reviewRubricSchema, failingDimensions } from '../pipeline/review.js';
import { renderCompetencyGraphBlock } from '../pipeline/plan.js';

interface SlotReport {
  slotId: string;
  out: string;
  ok: boolean;
}

function parseArgs(argv: string[]): { command: 'emit' | 'ingest'; course: string; dir: string } {
  const command = argv[0];
  if (command !== 'emit' && command !== 'ingest') {
    throw new Error('author-judge: first argument must be "emit" or "ingest"');
  }
  let course: string | undefined;
  let dir: string | undefined;
  for (let i = 1; i < argv.length; i++) {
    const value = argv[i + 1];
    const take = (name: string): string => {
      if (value === undefined || value.startsWith('--')) throw new Error(`author-judge: ${name} requires a value`);
      i++;
      return value;
    };
    if (argv[i] === '--course') course = take('--course');
    else if (argv[i] === '--dir') dir = take('--dir');
    else throw new Error(`author-judge: unknown flag "${argv[i]}"`);
  }
  if (!course || !dir) throw new Error('author-judge: --course and --dir are required');
  return { command, course, dir };
}

function validatedSlots(dir: string): Array<{ slotId: string; out: string; stem: string }> {
  const reportPath = join(dir, 'report.json');
  if (!existsSync(reportPath)) throw new Error('author-judge: report.json is missing — run author-validate.ts first');
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { slots: SlotReport[] };
  return report.slots
    .filter((s) => s.ok)
    .map((s) => ({ slotId: s.slotId, out: s.out, stem: s.out.replace(/^out\//, '').replace(/\.es-MX\.json$/, '') }));
}

function main(): void {
  const { command, course, dir } = parseArgs(process.argv.slice(2));
  const load = loadCourseCatalog(join('curriculum', course));
  const slots = enumerateSlots(load.course.adventures);
  const slotsById = new Map<string, Slot>(slots.map((s) => [s.slotId, s]));
  const firstSlotId = slots[0]?.slotId;
  const graph = buildCompetencyGraph(load.course);
  const ready = validatedSlots(dir);
  const judgeDir = join(dir, 'judge');
  mkdirSync(judgeDir, { recursive: true });

  if (command === 'emit') {
    writeFileSync(join(judgeDir, '_RUBRIC.md'), `${judgeSystemPrompt()}\n`, 'utf8');
    const todo: Array<{ slotId: string; stem: string; brief: string; verdict: string }> = [];

    for (const entry of ready) {
      const slot = slotsById.get(entry.slotId)!;
      const document = JSON.parse(readFileSync(join(dir, entry.out), 'utf8'));
      // `undefined` means "caller didn't say" and disables the check; the
      // course's very first lesson must be explicitly exempted with null.
      const prior = entry.slotId === firstSlotId ? null : (slot.priorMicroObjective ?? null);
      const competency = getCompetencyPromptContext(
        graph,
        `${slot.adventure.slug}/${slot.saga.slug}/${slot.topic.slug}`,
      );

      /*
       * The output path leads AND repeats, and says explicitly not to write
       * back into this file. Observed 2026-08-17: a reviewer agent wrote its
       * verdict INTO the brief it had just read, destroying the brief. The
       * ingest step refused it (fail-closed, nothing was silently accepted),
       * but the work had to be redone — so make the destination impossible to
       * miss rather than merely stated.
       */
      const brief = [
        `# JUDGE — ${entry.slotId}`,
        '',
        `> **OUTPUT FILE: \`judge/${entry.stem}.verdict.json\`** — a NEW file.`,
        `> Do NOT write your verdict into this brief (\`judge/${entry.stem}.judge.md\`); it is input only.`,
        '',
        'Read `judge/_RUBRIC.md` in this directory FIRST (once per session) — it is the full rubric, the solvability pass and every calibration. It is binding.',
        '',
        'The verdict file must contain EXACTLY this object and nothing else — no fences, no prose:',
        '`{"age_fit":N,"pedagogy":N,"narrative_quality":N,"kid_safety":N,"naturalness":N,"concreteness":N,"cognitive_engagement":N,"feedback_quality":N,"distractor_quality":N,"notes":"..."}`',
        '',
        judgePriorLine(prior) ?? '',
        '',
        '## LESSON DOCUMENT',
        '',
        '```json',
        JSON.stringify(document, null, 2),
        '```',
        ...(competency ? ['', renderCompetencyGraphBlock(competency)] : []),
        '',
        '---',
        `Write your verdict JSON to \`judge/${entry.stem}.verdict.json\`. Do not modify this brief.`,
        '',
      ].join('\n');

      writeFileSync(join(judgeDir, `${entry.stem}.judge.md`), brief, 'utf8');
      todo.push({
        slotId: entry.slotId,
        stem: entry.stem,
        brief: `judge/${entry.stem}.judge.md`,
        verdict: `judge/${entry.stem}.verdict.json`,
      });
    }

    writeFileSync(join(judgeDir, 'todo.json'), `${JSON.stringify({ course, slots: todo }, null, 2)}\n`, 'utf8');
    console.log(`author-judge emit: ${todo.length} judge brief(s) → ${judgeDir}`);
    return;
  }

  // ---- ingest ----
  const results: Array<{
    slotId: string;
    stem: string;
    ok: boolean;
    failing: string[];
    notes: string;
    problems: string[];
  }> = [];

  for (const entry of ready) {
    const verdictPath = join(dir, `judge/${entry.stem}.verdict.json`);
    const base = { slotId: entry.slotId, stem: entry.stem, failing: [] as string[], notes: '', problems: [] as string[] };
    if (!existsSync(verdictPath)) {
      results.push({ ...base, ok: false, problems: ['no verdict file written'] });
      continue;
    }
    const parsedRubric = reviewRubricSchema.safeParse(JSON.parse(readFileSync(verdictPath, 'utf8')));
    if (!parsedRubric.success) {
      results.push({ ...base, ok: false, problems: parsedRubric.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
      continue;
    }
    const document = lessonDocumentSchema.parse(JSON.parse(readFileSync(join(dir, entry.out), 'utf8')));
    /*
     * The VERDICT is decided here, by the pipeline's own document-aware floors
     * — a lesson made entirely of low-decision types gets relaxed concreteness
     * and engagement floors, exactly as `passesJudgeGate` does. Never let the
     * reviewing agent decide whether it passed: floors are code.
     */
    const failing = failingDimensions(parsedRubric.data, document);
    results.push({
      ...base,
      ok: failing.length === 0,
      failing,
      notes: parsedRubric.data.notes,
    });
  }

  writeFileSync(join(dir, 'judge', 'judge-report.json'), `${JSON.stringify({ course, results }, null, 2)}\n`, 'utf8');

  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.log(`author-judge ingest: ${passed.length}/${results.length} cleared the judge floors`);
  for (const r of failed) {
    console.log(`\n  REVISE ${r.slotId}`);
    if (r.problems.length > 0) for (const p of r.problems) console.log(`    ${p}`);
    if (r.failing.length > 0) console.log(`    below floor: ${r.failing.join(', ')}`);
    if (r.notes) console.log(`    notes: ${r.notes.slice(0, 400)}`);
  }
  // Judge failures are a REVISION list, not a crash: the caller decides whether
  // to revise or accept. Exit non-zero so it cannot be missed in a pipeline.
  if (failed.length > 0) process.exitCode = 1;
}

main();
