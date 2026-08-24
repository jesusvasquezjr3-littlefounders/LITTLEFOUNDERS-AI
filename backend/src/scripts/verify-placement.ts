#!/usr/bin/env node
/*
 * `npm run placement:verify` — drives the REAL placement algorithm over the
 * REAL catalog and reports how well it can actually place people.
 *
 * (Named `placement:verify`, not `verify:placement`: the frontend already owns
 * that second name for the Tutor's 3D character placement, and two unrelated
 * checks answering to one name is how a green run gets read as proof of the
 * wrong thing.)
 *
 * WHY THIS EXISTS. The unit suite proves the search is correct against
 * synthetic courses, and it does that well. It cannot prove anything about the
 * shapes a synthetic course does not have: partial probe coverage, topics
 * emptied by an archiving pass, and prerequisite edges pointing across both.
 * The first run of this script found an expert learner being capped at topic
 * 144 of 259 on the published course — a silent 55% ceiling for everyone,
 * caused by edges left pointing at topics an archive pass had removed. No
 * fixture had that shape, and no gate could have.
 *
 * WHAT IT REPORTS, and what each number means when it moves:
 *   - probe coverage      — how much of the course the quiz can even ask about.
 *   - placement error     — |where a learner was placed − what they know|.
 *                           Small residual error is EXPECTED and correct: the
 *                           search will not credit past a topic it could not
 *                           verify. A LARGE error at the top of the course is
 *                           the cap signature and should be investigated.
 *   - questions asked     — must stay within MAX_QUESTIONS.
 *   - the age invariant   — identical answers must place identically whatever
 *                           the learner claimed about themselves. This is the
 *                           product promise, checked against live data rather
 *                           than only in a unit test.
 *
 * Read-only: it writes nothing, calls no model, and costs nothing. Operator
 * tool, not CI — it needs production credentials, the same posture as
 * coursegen's `graph:backfill`.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run placement:verify
 *   … [-- --course <slug>]
 */

import { pathToFileURL } from 'node:url';
import {
  MAX_QUESTIONS,
  nextPlacementStep,
  type GradedAnswer,
  type PlacementSignals,
  type PlacementTopic,
} from '../services/placementAlgorithm.js';

const DEFAULT_COURSES = ['financial-education', 'entrepreneurship', 'investing'];

interface TopicRow {
  id: string;
  slug: string;
  position: number;
  placement_probe: unknown;
  prerequisites: Array<{ path: string; strength: 'hard' | 'soft' }> | null;
  lessons: Array<{ id: string; status: string; position: number }>;
}

interface AdventureRow {
  slug: string;
  position: number;
  sagas: Array<{ slug: string; position: number; topics: TopicRow[] }>;
}

function requireEnv(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('placement:verify needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  return { url, key };
}

async function rest<T>(path: string): Promise<T> {
  const { url, key } = requireEnv();
  const res = await fetch(`${url}/rest/v1${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Mirrors `courseTree.flattenTopicsForPlacement` — playable topics only, with
 * the edges that point at unplayable ones dropped. Both halves, deliberately:
 * hand-rolling only the first half is exactly what this script was written to
 * catch, and re-introducing that asymmetry here would make the report lie in
 * the same direction as the bug.
 */
async function loadTopics(courseSlug: string): Promise<PlacementTopic[]> {
  const [course] = await rest<Array<{ id: string }>>(`/courses?select=id&slug=eq.${encodeURIComponent(courseSlug)}`);
  if (!course) throw new Error(`no course "${courseSlug}" in Vault`);

  const adventures = await rest<AdventureRow[]>(
    `/adventures?select=slug,position,sagas(slug,position,topics(id,slug,position,placement_probe,prerequisites,lessons(id,status,position)))` +
      `&course_id=eq.${course.id}&order=position`,
  );

  const all: PlacementTopic[] = [];
  for (const adventure of [...adventures].sort((a, b) => a.position - b.position)) {
    for (const saga of [...(adventure.sagas ?? [])].sort((a, b) => a.position - b.position)) {
      for (const topic of [...(saga.topics ?? [])].sort((a, b) => a.position - b.position)) {
        all.push({
          id: topic.id,
          path: `${adventure.slug}/${saga.slug}/${topic.slug}`,
          hasProbe: topic.placement_probe !== null && topic.placement_probe !== undefined,
          prerequisites: (topic.prerequisites ?? []).map((p) => ({ path: p.path, strength: p.strength })),
          lessonIds: (topic.lessons ?? [])
            .filter((l) => l.status !== 'archived')
            .sort((a, b) => a.position - b.position)
            .map((l) => l.id),
        });
      }
    }
  }

  const playable = all.filter((t) => t.lessonIds.length > 0);
  const paths = new Set(playable.map((t) => t.path));
  const sagaPaths = new Set(playable.map((t) => t.path.split('/').slice(0, 2).join('/')));
  return playable.map((t) => ({
    ...t,
    prerequisites: t.prerequisites.filter((p) => paths.has(p.path) || sagaPaths.has(p.path)),
  }));
}

/** Walks the whole quiz against a learner who genuinely knows the first `trueFrontier` topics. */
function simulate(topics: readonly PlacementTopic[], signals: PlacementSignals, trueFrontier: number) {
  const indexById = new Map(topics.map((t, i) => [t.id, i]));
  const graded: GradedAnswer[] = [];
  const asked: number[] = [];
  for (let guard = 0; guard <= MAX_QUESTIONS + 2; guard++) {
    const step = nextPlacementStep(topics, signals, graded);
    if (step.kind === 'done') return { done: step, asked };
    const index = indexById.get(step.topicId)!;
    asked.push(index);
    graded.push({ topicId: step.topicId, correct: index < trueFrontier });
  }
  throw new Error('the quiz did not terminate');
}

async function report(courseSlug: string): Promise<boolean> {
  let topics: PlacementTopic[];
  try {
    topics = await loadTopics(courseSlug);
  } catch (err) {
    console.log(`\n=== ${courseSlug} ===\n  ${(err as Error).message}`);
    return true;
  }

  const probed = topics.filter((t) => t.hasProbe).length;
  const lessons = topics.reduce((n, t) => n + t.lessonIds.length, 0);
  const coverage = topics.length > 0 ? (probed / topics.length) * 100 : 0;

  console.log(`\n=== ${courseSlug} ===`);
  console.log(`  ${topics.length} playable topics · ${probed} probed (${coverage.toFixed(0)}%) · ${lessons} live lessons`);

  if (topics.length === 0) return true;

  const targets = [...new Set([0, 1, Math.floor(topics.length * 0.25), Math.floor(topics.length * 0.5), Math.floor(topics.length * 0.9), topics.length])];
  let worstError = 0;
  let mostQuestions = 0;
  let capped = false;

  for (const target of targets) {
    const { done, asked } = simulate(topics, {}, target);
    const error = Math.abs(done.frontier - target);
    worstError = Math.max(worstError, error);
    mostQuestions = Math.max(mostQuestions, asked.length);
    capped ||= done.cappedByPrerequisite;
    console.log(
      `  knows ${String(target).padStart(4)} -> placed ${String(done.frontier).padStart(4)} ` +
        `(off ${String(error).padStart(3)}) · ${String(done.creditedLessonIds.length).padStart(4)} lessons credited · ${asked.length} questions` +
        (done.cappedByPrerequisite ? '  [PREREQUISITE CAP]' : ''),
    );
  }

  /*
   * The product promise, checked on live data. If this ever prints DIVERGED,
   * placement has started depending on who the learner said they were, and that
   * is a defect regardless of how good the numbers above look.
   */
  const target = Math.floor(topics.length * 0.6);
  const adult = simulate(topics, { claimedLevel: 'confident', educationLevel: 'adult', ageYears: 38 }, target).done.frontier;
  const child = simulate(topics, { claimedLevel: 'new', educationLevel: 'preschool', ageYears: 6 }, target).done.frontier;
  const blind = simulate(topics, {}, target).done.frontier;
  const identical = adult === child && child === blind;

  console.log(`  worst error ${worstError} topic(s) · never more than ${mostQuestions} questions`);
  console.log(`  same answers, adult vs child vs no-signals: ${adult}/${child}/${blind} — ${identical ? 'IDENTICAL ✓' : 'DIVERGED ✗'}`);

  if (!identical) {
    console.error('  ✗ placement depended on what the learner claimed about themselves.');
    return false;
  }
  /*
   * A big error at the TOP of the course is the cap signature: a learner who
   * knows everything being held far back. A big error with low coverage is just
   * an unprobed course and is reported, not failed.
   */
  if (capped && worstError > topics.length * 0.1) {
    console.error(`  ✗ a prerequisite cap is holding learners back by ${worstError} topics — look for edges pointing at archived content.`);
    return false;
  }
  if (coverage < 60) {
    console.log(`  ⚠ only ${coverage.toFixed(0)}% probed — the quiz cannot verify past what it can ask. Run coursegen's graph:backfill.`);
  }
  return true;
}

async function main(): Promise<void> {
  const i = process.argv.indexOf('--course');
  const courses = i >= 0 && process.argv[i + 1] ? [process.argv[i + 1]!] : DEFAULT_COURSES;
  let ok = true;
  for (const slug of courses) ok = (await report(slug)) && ok;
  if (!ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`placement:verify failed: ${(err as Error).message}`);
    process.exit(1);
  });
}
