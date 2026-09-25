// Lesson-policy gates 14–16 (S05.4b): B.17 concept cap, B.11 mentor
// misjudgment, B.16 regional adaptation.
//
// Unlike gates 11–13, which read a document alone, these need the CATALOG: a
// lesson's declared density and its place in course order (B.17), whether it
// is a flagged mentor-misjudgment episode (B.11) and its market scenarios
// (B.16). `buildCoursePolicy` derives one LessonPolicy per lesson from a loaded
// course, plus the catalog-level findings; `runLessonPolicyGates` checks a
// generated document against its policy.
//
// Catalog findings that block are decided BEFORE generation (the Forge run
// skips such a slot with zero spend; a paid corrective retry cannot fix a
// catalog declaration) and again at release (content:gates, verify:course).
// The document checks run inside runAllGates, so the write retry, the judge's
// revision, localization and verify:course all enforce them.

import type { CourseCatalog } from '../catalog/loader.js';
import type { FactsFile } from '../catalog/schema.js';
import type { GateProblem } from '../pipeline/gates.js';
import { analyzeConceptCatalog, type ConceptPolicy, type ConceptLessonInput } from './conceptCap.js';
import {
  MIN_EPISODE_VOICED_MOMENTS,
  MIN_MISJUDGMENT_EPISODES_PER_COURSE,
  scanShame,
  voicedMoments,
  type MisjudgmentPolicy,
} from './misjudgment.js';
import { analyzeRegionalLesson, checkRegionalDocument, loadMarketInventory, type MarketInventory, type RegionalPolicy } from './regional.js';
import { screenBlocks, narrationUnits, type LessonDocumentLike } from './lessonModel.js';
import { foldText, hasTerm } from './text.js';
import type { ContentLocale } from './budgets.js';

export const POLICY_GATE = { conceptCap: 14, misjudgment: 15, regional: 16 } as const;

export interface LessonPolicy {
  lesson: string;
  path: string;
  tier: string;
  concepts: ConceptPolicy;
  misjudgment?: MisjudgmentPolicy;
  regional: RegionalPolicy;
}

export interface PolicyFinding {
  gate: 14 | 15 | 16;
  spec: 'B.17' | 'B.11' | 'B.16';
  severity: 'block' | 'review';
  /** Lesson slug; absent for a course-level finding. */
  lesson?: string;
  message: string;
}

export interface CoursePolicy {
  course: string;
  lessons: Map<string, LessonPolicy>;
  findings: PolicyFinding[];
  metrics: {
    lessons: number;
    /** B.17: lessons whose density is declared. */
    densityDeclared: number;
    /** B.11: Mentor-Misjudgment Content Coverage for this course. */
    misjudgmentEpisodes: number;
    misjudgmentMinimum: number;
    /** B.16: lessons that need market scenarios, and how many declare them. */
    regionalRequired: number;
    regionalDeclared: number;
  };
}

/** Lesson blueprints in course order (adventure, saga, topic, lesson position). */
function orderedLessons(course: CourseCatalog) {
  const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
  const out = [];
  for (const { data } of [...course.adventures].sort((a, b) => a.data.adventure.position - b.data.adventure.position)) {
    for (const saga of [...data.sagas].sort(byPosition)) {
      for (const topic of [...saga.topics].sort(byPosition)) {
        for (const lesson of [...topic.lessons].sort(byPosition)) {
          out.push({ adventure: data.adventure, saga, topic, lesson, path: `${data.adventure.slug}/${saga.slug}/${topic.slug}/${lesson.slug}` });
        }
      }
    }
  }
  return out;
}

export function buildCoursePolicy(course: CourseCatalog, options: { register?: 'kid' | 'adult'; markets?: MarketInventory } = {}): CoursePolicy {
  const markets = options.markets ?? loadMarketInventory();
  const register = options.register ?? 'kid';
  const lessons = orderedLessons(course);
  const findings: PolicyFinding[] = [];

  const conceptInputs: ConceptLessonInput[] = lessons.map((l) => ({
    slug: l.lesson.slug,
    path: l.path,
    tier: l.adventure.age_tier,
    review: l.topic.kind !== 'teaching' || l.saga.kind === 'review',
    ...(l.lesson.new_concepts ? { declared: l.lesson.new_concepts } : {}),
  }));
  const concepts = analyzeConceptCatalog(conceptInputs, course.taxonomy, course.concepts, register);
  for (const f of concepts.findings) findings.push({ gate: 14, spec: 'B.17', ...f });

  const policies = new Map<string, LessonPolicy>();
  let episodes = 0;
  let regionalRequired = 0;
  let regionalDeclared = 0;
  for (const l of lessons) {
    const episode = l.lesson.mentor_misjudgment;
    if (episode) {
      episodes += 1;
      findings.push({
        gate: 15,
        spec: 'B.11',
        severity: 'review',
        lesson: l.lesson.slug,
        message: `${l.path}: mentor-misjudgment episode (${episode.character}) awaits content-team validation — is the misjudgment real, the recovery honest and the framing free of shame?`,
      });
    }
    const regional = analyzeRegionalLesson(
      {
        slug: l.lesson.slug,
        path: l.path,
        factRefs: l.topic.fact_refs ?? [],
        briefs: [l.lesson.micro_objective, l.lesson.narrative_beat, l.topic.concept, l.topic.learning_objective],
        ...(l.lesson.regional_scenarios ? { scenarios: l.lesson.regional_scenarios as never } : {}),
      },
      course.facts as FactsFile | undefined,
      markets,
    );
    if (regional.policy.required) regionalRequired += 1;
    if (regional.policy.required && regional.policy.scenarios) regionalDeclared += 1;
    for (const f of regional.findings) findings.push({ gate: 16, spec: 'B.16', ...f });
    policies.set(l.lesson.slug, {
      lesson: l.lesson.slug,
      path: l.path,
      tier: l.adventure.age_tier,
      concepts: concepts.policies.get(l.lesson.slug)!,
      ...(episode ? { misjudgment: episode } : {}),
      regional: regional.policy,
    });
  }

  if (episodes < MIN_MISJUDGMENT_EPISODES_PER_COURSE) {
    findings.push({
      gate: 15,
      spec: 'B.11',
      severity: 'block',
      message: `course has ${episodes} mentor-misjudgment episode(s); B.11 requires at least ${MIN_MISJUDGMENT_EPISODES_PER_COURSE} — flag a lesson with mentor_misjudgment (a mentor makes and recovers from a real money misjudgment)`,
    });
  }

  return {
    course: course.catalog?.course.slug ?? 'unknown',
    lessons: policies,
    findings,
    metrics: {
      lessons: lessons.length,
      densityDeclared: concepts.declaredLessons,
      misjudgmentEpisodes: episodes,
      misjudgmentMinimum: MIN_MISJUDGMENT_EPISODES_PER_COURSE,
      regionalRequired,
      regionalDeclared,
    },
  };
}

/** Blocking catalog findings for one lesson: the reason a Forge slot is skipped before any paid stage. */
export function blockingLessonFindings(policy: CoursePolicy, lesson: string): PolicyFinding[] {
  return policy.findings.filter((f) => f.lesson === lesson && f.severity === 'block');
}

// ---- document gates -------------------------------------------------------------------

const LOCALES: readonly ContentLocale[] = ['en-US', 'es-MX', 'pt-BR'];

/** Everything a learner can see or hear in a v1 document, one string. */
export function documentText(document: LessonDocumentLike): string {
  const { blocks } = screenBlocks(document);
  const scripts = narrationUnits(document).filter((u) => u.script).map((u) => u.text);
  return [...blocks.map((b) => b.raw), ...scripts].join('\n');
}

export interface PolicyGateReport {
  problems: GateProblem[];
  /** Concepts a lesson uses ahead of the lesson that introduces them (B.17). */
  earlyConcepts: string[];
}

export function runLessonPolicyGates(
  document: LessonDocumentLike,
  policy: LessonPolicy | undefined,
  markets: MarketInventory = loadMarketInventory(),
): PolicyGateReport {
  const locale = (LOCALES.includes(document.meta?.locale as ContentLocale) ? document.meta?.locale : 'es-MX') as ContentLocale;
  const text = documentText(document);
  const folded = foldText(text);
  const problems: GateProblem[] = [];
  const earlyConcepts: string[] = [];

  // Gate 14 — B.17: a later lesson's concept used here is an undeclared new concept.
  if (policy) {
    const { concepts } = policy;
    for (const future of concepts.future) {
      const hit = (future.terms[locale] ?? []).find((term) => hasTerm(folded, term));
      if (hit) {
        earlyConcepts.push(future.id);
        problems.push({
          gate: 14,
          message: `uses "${hit}" (concept "${future.id}"), which ${future.lesson} introduces later — an undeclared new concept; teach it there, not here`,
        });
      }
    }
    const total = (concepts.declared?.length ?? 0) + earlyConcepts.length;
    if (earlyConcepts.length > 0 && total > concepts.ceiling) {
      problems.push({
        gate: 14,
        message: `introduces ${total} new concepts (${concepts.declared?.length ?? 0} declared + ${earlyConcepts.length} early), over the ${concepts.band} ceiling of ${concepts.ceiling}`,
      });
    }
  }

  // Gate 15 — B.11: a flagged episode really stages the misjudgment and the recovery, without shame.
  if (policy?.misjudgment) {
    const { character } = policy.misjudgment;
    const cast = (document as { meta?: { cast?: string[] } }).meta?.cast ?? [];
    if (!cast.includes(character)) {
      problems.push({ gate: 15, message: `mentor-misjudgment episode: ${character} must be in meta.cast and make the misjudgment on stage` });
    }
    const moments = voicedMoments(document as never, character);
    if (moments < MIN_EPISODE_VOICED_MOMENTS) {
      problems.push({
        gate: 15,
        message: `mentor-misjudgment episode: ${character} speaks in ${moments} moment(s); show the misjudgment and the recovery in their own voice (at least ${MIN_EPISODE_VOICED_MOMENTS})`,
      });
    }
  }
  if (policy?.misjudgment) {
    for (const phrase of scanShame(text, locale)) {
      problems.push({
        gate: 15,
        message: `mentor-misjudgment episode: "${phrase}" is self-global shame language — name the decision and what changes next ("I forgot to count the bag"), never the person`,
      });
    }
  }

  // Gate 16 — B.16: translated, not localized.
  for (const finding of checkRegionalDocument(text, locale, policy?.regional, markets)) {
    problems.push({ gate: 16, message: finding.message });
  }

  return { problems, earlyConcepts };
}
