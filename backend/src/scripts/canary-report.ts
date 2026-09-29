#!/usr/bin/env node
/*
 * `npm run tutor:canary-report` — the Stage 5 reader's tool for Product C.22
 * (Appendix E 3.1: Tier 2 "released via canary rollout"; Appendix F Part 3
 * Stage 5 and 1.4 Canary Regression Rate).
 *
 *   Arms        the proposal's canary and control sessions in the window, how
 *               many were rules-scored, and the share that failed any rules
 *               criterion (the dashboard's canary.arm_comparison signal).
 *   Sample      `--sample=N [--seed=S]` draws a REPRODUCIBLE sample of closed
 *               canary-arm sessions (default 20, the governance minimum; the
 *               same seed draws the same sessions). The reader reads each one
 *               and records the outcome in the proposal's `stage5`
 *               (`reader`, `date`, `transcriptsRead`, `outcome`).
 *   Transcripts `--transcripts` prints the sampled sessions' turns. Canary
 *               arms hold verified adults only (OD-23); each learner is
 *               re-checked here and a session whose learner now reads as a
 *               minor is skipped, never printed.
 *
 * Reads only. No model call; costs nothing. Operator tool:
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm run tutor:canary-report -- --proposal=P-YYYY-MM-DD-<slug> [--since=YYYY-MM-DD] [--sample=N --seed=S] [--transcripts] [--json]
 *
 * Exit code 1 when the canary arm is clearly worse than its control (the
 * dashboard's disparity rule) or when a read fails.
 */

import { serviceRest } from '../services/supabaseRest.js';
import { getRolesForGate } from '../services/insights.js';
import { requiresMinorMentorSafeguards } from '../services/mentorSafety.js';
import { TRANSCRIPT_RUBRIC_HASH } from '../services/pedagogy/transcriptRubric.js';
import { disparities } from '../services/pedagogy/mentorQuality.js';
import { drawCanarySample, PROPOSAL_ID, summarizeCanaryArms, type CanaryArm } from '../services/pedagogy/mentorCanary.js';

const PAGE = 1000;
const MAX_ROWS = 200_000;
const MIN_READ = 20;

async function readAll<T>(path: string): Promise<T[] | null> {
  const out: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const page = await serviceRest<T[]>(`${path}&limit=${PAGE}&offset=${offset}`);
    if (page === null) return null;
    out.push(...page);
    if (page.length < PAGE) return out;
  }
  return out;
}

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

interface ArmRow {
  id: string;
  user_id: string;
  canary_arm: CanaryArm;
  ended_at: string | null;
  turn_count: number;
}

async function main(): Promise<number> {
  const proposal = arg('proposal');
  if (proposal === null || !PROPOSAL_ID.test(proposal)) throw new Error('--proposal=P-YYYY-MM-DD-<slug> is required');
  const since = arg('since') ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error('--since must be YYYY-MM-DD');
  const sizeArg = arg('sample');
  const size = sizeArg === null ? MIN_READ : Number(sizeArg);
  if (!Number.isInteger(size) || size < 1 || size > 500) throw new Error('--sample must be a whole number between 1 and 500');
  const seed = arg('seed') ?? proposal;

  const sessions = await readAll<ArmRow>(
    `/tutor_sessions?select=id,user_id,canary_arm,ended_at,turn_count&canary_proposal_id=eq.${encodeURIComponent(proposal)}&started_at=gte.${since}&order=started_at.asc`,
  );
  if (sessions === null) {
    console.error('Could not read the canary sessions.');
    return 1;
  }
  const scores: { session_id: string | null; outcome: string }[] = [];
  for (let i = 0; i < sessions.length; i += 100) {
    const ids = sessions
      .slice(i, i + 100)
      .map((s) => s.id)
      .join(',');
    const page = await readAll<{ session_id: string | null; outcome: string }>(
      `/tutor_transcript_score?select=session_id,outcome&scorer=eq.rules&rubric_hash=eq.${TRANSCRIPT_RUBRIC_HASH}&session_id=in.(${ids})`,
    );
    if (page === null) {
      console.error('Could not read the transcript scores.');
      return 1;
    }
    scores.push(...page);
  }
  const arms = summarizeCanaryArms(sessions, scores);
  const regression = disparities([
    { key: 'canary', hits: arms.canary.failing, n: arms.canary.scored },
    { key: 'control', hits: arms.control.failing, n: arms.control.scored },
  ]).find((d) => d.key === 'canary');
  const closed = sessions.filter((s) => s.canary_arm === 'canary' && s.ended_at !== null && s.turn_count > 0).map((s) => s.id);
  const sample = drawCanarySample(closed, size, seed);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ proposal, since, arms, regression: regression ?? null, seed, sample }, null, 2));
  } else {
    console.log(`Canary ${proposal} since ${since}`);
    for (const name of ['canary', 'control'] as const) {
      const a = arms[name];
      const share = a.failShare === null ? 'n/a' : `${(a.failShare * 100).toFixed(1)}%`;
      console.log(`  ${name.padEnd(7)} ${a.sessions} session(s), ${a.scored} scored, failing any rules criterion: ${share}`);
    }
    console.log(
      regression
        ? `  REGRESSION: the canary arm is clearly worse than control (${(regression.rate * 100).toFixed(1)}% vs ${(regression.rest * 100).toFixed(1)}%)`
        : '  No regression by the disparity rule (or not enough scored sessions yet).',
    );
    console.log(`  Reading sample (seed ${seed}, ${sample.length} of ${closed.length} closed canary-arm session(s); at least ${MIN_READ} before release):`);
    for (const id of sample) console.log(`    ${id}`);
    if (sample.length < MIN_READ) console.log(`  Fewer than ${MIN_READ} closed canary-arm sessions exist: Stage 5 cannot clear yet.`);
  }

  if (process.argv.includes('--transcripts')) {
    const owners = new Map(sessions.map((s) => [s.id, s.user_id]));
    for (const id of sample) {
      const userId = owners.get(id)!;
      const roles = await getRolesForGate(userId);
      if (roles === null || (await requiresMinorMentorSafeguards(userId, roles))) {
        console.log(`\n== ${id}: skipped (the learner is not a verified adult now; a minor's transcript is never printed)`);
        continue;
      }
      const turns = await readAll<{ seq: number; speaker: string; text: string }>(
        `/tutor_turns?select=seq,speaker,text&session_id=eq.${id}&order=seq.asc`,
      );
      console.log(`\n== ${id}`);
      if (turns === null) console.log('  (could not read this transcript)');
      else for (const t of turns) console.log(`  ${String(t.seq).padStart(3)} ${t.speaker.padEnd(7)} ${t.text}`);
    }
  }
  return regression ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
