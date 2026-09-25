/*
 * `npm run gym:pedagogy` — RUN REACTIVE SIMULATED STUDENTS AGAINST THE REAL
 * CONTROLLER (V4 harness backlog, ROADMAP.md "Remaining harness phases").
 *
 * This is a thin CLI shell. All the real logic — the student archetypes, the
 * driving loop, the checks — lives in `src/tutor/pedagogyGym.ts` (a real
 * `src/` module, unlike `verify-pedagogy.ts`'s all-in-one script) so it has
 * an actual vitest suite (`src/__tests__/pedagogyGym.test.ts`) rather than
 * being provable only by running the CLI and reading its output.
 *
 * `--json` prints a machine-readable report instead of the human one — for a
 * future consumer that wants to diff two runs (before/after a threshold
 * change) rather than read a transcript.
 */

import process from 'node:process';
import { runPedagogyGym } from '../src/tutor/pedagogyGym.js';
import { runSessionEndGym } from '../src/tutor/sessionEndGym.js';

function printHuman(reports: ReturnType<typeof runPedagogyGym>['reports']): void {
  console.log('== The simulated-student gym: reactive students against the real controller ==');
  console.log('');
  for (const report of reports) {
    console.log(`  ${report.problems.length === 0 ? 'ok  ' : 'FAIL'}  ${report.scenario}`);
    console.log(`        ${report.sequence.join(' ')}`);
    const counts = Object.entries(report.strategyCounts)
      .map(([strategy, count]) => `${strategy}:${count}`)
      .join(' ');
    console.log(`        counts: ${counts || '(no turns ran)'}`);
    if (!report.completed) {
      console.log(`        ↳ turn budget exhausted — ${report.turnsRun}/${report.turnBudget} turns ran, plan never completed`);
    }
    for (const problem of report.problems) console.log(`        ↳ ${problem}`);
  }
}

function main(): void {
  const controller = runPedagogyGym();
  const { reports } = controller;
  /*
   * C.8/C.12: the behavioral-signature session-end signal against Appendix F
   * Part 3 Stage 2's simulated learners (`src/tutor/sessionEndGym.ts`).
   */
  const sessionEnd = runSessionEndGym();
  const ok = controller.ok && sessionEnd.ok;

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ ok, reports, sessionEnd: sessionEnd.reports }, null, 2));
  } else {
    printHuman(reports);
    console.log('');
    console.log('== The session-end signal (C.8/C.12) against the simulated learners ==');
    console.log('');
    for (const report of sessionEnd.reports) {
      const offers = report.offers.map((o) => `minute ${o.minute.toFixed(1)}`).join(', ') || 'no offer';
      console.log(`  ${report.problems.length === 0 ? 'ok  ' : 'FAIL'}  ${report.persona}: ${offers} (${report.firings} firing(s))`);
      for (const problem of report.problems) console.log(`        ↳ ${problem}`);
    }
    console.log('');
    const totalProblems =
      reports.reduce((sum, report) => sum + report.problems.length, 0) +
      sessionEnd.reports.reduce((sum, report) => sum + report.problems.length, 0);
    if (!ok) {
      console.log(`gym:pedagogy FAILED — ${totalProblems} problem(s) across ${reports.length} scenario(s).`);
      console.log('Each of these archetypes is a reactive student; a violation here is a sequence a real session could produce.');
    } else {
      console.log(
        `gym:pedagogy OK — ${reports.length} reactive student archetype(s) and ${sessionEnd.reports.length} session-end persona(s), no guardrail violations.`,
      );
    }
  }

  if (!ok) process.exit(1);
}

main();
