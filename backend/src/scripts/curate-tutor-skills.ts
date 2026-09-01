#!/usr/bin/env node
/*
 * `npm run curate:tutor-skills` — the V4 harness backlog's "skill distiller/
 * curator loop". Reads the live KC graph, misconception catalog and real
 * attempt/evidence aggregates from Vault, cross-references them against
 * `oracle/skills/moves/*.md`, and prints a PROPOSE-ONLY markdown report. See
 * `services/pedagogy/tutorCurator.ts` for the analysis itself (pure,
 * deterministic, unit-tested) — this file is only the I/O around it, same
 * split `coursegen/coachCli.ts` uses for `pipeline/coach.ts`.
 *
 * NEVER WRITES ANYTHING. See tutorCurator.ts's own header for why.
 *
 * Operator tool, not CI (needs credentials AND a full monorepo checkout —
 * see the note on SKILLS_DIR below), same posture as seed:kc and
 * audit:content-bridge:
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run curate:tutor-skills
 *
 * NOT YET WIRED TO A SCHEDULE. `audit:content-bridge` runs daily via
 * `.github/workflows/tutor-content-bridge.yml` because a fixed defect could
 * recur silently; this tool's proposals are a standing authoring backlog, not
 * a regression to catch, so an operator running it by hand (or a human
 * deciding to add a schedule later) is the right cadence for a first version.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  getActiveKcs,
  getAggregateMasteryByKc,
  getAggregateMisconceptionEvidence,
  getKcEdges,
  getMisconceptionsForKcs,
} from '../services/pedagogy/kcData.js';
import {
  diagnoseCuration,
  parseSkillMisconceptionRef,
  renderCurationMarkdown,
  type CurationInput,
} from '../services/pedagogy/tutorCurator.js';

/*
 * `oracle/skills/moves/*.md` lives in a SIBLING package, not inside this
 * one's own deployed build — backend's Railway deploy uses
 * `railway up backend --path-as-root`, which ships ONLY this directory, so
 * this path is unreachable from a RUNNING backend service (and this file is
 * never imported by src/index.ts — it is invoked standalone, exactly like
 * seed-kc-graph.ts and audit-content-bridge.ts). It resolves correctly for
 * every actual caller of this script: a developer's own full checkout, or a
 * CI job that does a plain `actions/checkout@v4` before `npm run --prefix
 * backend curate:tutor-skills` — the same shape
 * `.github/workflows/tutor-content-bridge.yml` already uses for its sibling
 * script, because `import.meta.url` anchors to the FILE's location on disk,
 * not to the process's current working directory.
 */
const SKILLS_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../oracle/skills/moves');

function readSkillCatalogue(): CurationInput['skills'] {
  let files: string[];
  try {
    files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
  } catch (error) {
    throw new Error(
      `could not read ${SKILLS_DIR} — this tool needs a full monorepo checkout (backend/ AND oracle/ side by ` +
        `side), not backend/ alone: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return files.map((file) => parseSkillMisconceptionRef(readFileSync(path.join(SKILLS_DIR, file), 'utf8'), file));
}

async function main(): Promise<void> {
  const skills = readSkillCatalogue();

  const kcs = await getActiveKcs();
  // A null read is a FAILED fetch, never "zero active KCs" (§1.14) — the
  // same distinction audit-content-bridge.ts already draws on this exact call.
  if (kcs === null) {
    throw new Error('could not read the kc table — refusing to report a curation summary from an unanswered query');
  }
  const kcIds = kcs.map((k) => k.id);

  const [edges, misconceptions, masteryByKc, misconceptionEvidence] = await Promise.all([
    getKcEdges(),
    getMisconceptionsForKcs(kcIds),
    getAggregateMasteryByKc(),
    getAggregateMisconceptionEvidence(),
  ]);
  if (edges === null) throw new Error('could not read kc_edge — refusing to report on an unanswered query');
  if (misconceptions === null) throw new Error('could not read misconception — refusing to report on an unanswered query');
  if (masteryByKc === null) throw new Error('could not read learner_kc_mastery — refusing to report on an unanswered query');
  if (misconceptionEvidence === null) {
    throw new Error('could not read learner_misconception — refusing to report on an unanswered query');
  }

  const input: CurationInput = {
    kcs: kcs.map((k) => ({ id: k.id, key: k.key, skillKey: k.skill_key })),
    edges: edges.map((e) => ({ prerequisiteKcId: e.prerequisite_kc_id, dependentKcId: e.dependent_kc_id })),
    misconceptions: misconceptions.map((m) => ({ id: m.id, kcId: m.kc_id, code: m.code })),
    skills,
    masteryByKc,
    misconceptionEvidence,
  };

  const report = diagnoseCuration(input);
  console.log(renderCurationMarkdown(new Date().toISOString().slice(0, 10), report));
  console.log(
    `curate:tutor-skills OK — ${report.actions.length} proposed action(s) across ${input.kcs.length} KC(s) ` +
      `and ${input.skills.length} skill(s). Nothing was written.`,
  );
}

main().catch((err) => {
  console.error(`::error::curate:tutor-skills FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
