import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adoptedSources, adoptOpening, sequence } from './factory.mjs';
import { commitment } from './commitments.mjs';
import { capacity } from './capacity.mjs';
import { dates } from './dates.mjs';
import { borrowing } from './borrowing.mjs';
import { transfers } from './transfers.mjs';
import { uncertainIncome } from './uncertain-income.mjs';
import { reviewPayments } from './review-payments.mjs';
import { reviewChanges } from './review-changes.mjs';
import * as foundations from './foundations/index.mjs';
import * as money from './money-management/index.mjs';
import * as future from './future-finance/index.mjs';
import * as integrated from './integrated-decisions/index.mjs';
import { resolveSkill, prerequisiteSkills, skillMapping, skillReconciliation } from './skill-map.mjs';
import { unitTitles } from './units.mjs';
import { compactEnglishTitle } from './compact-titles.mjs';
import { storyCopyProblems } from './screen-copy.mjs';

const root = new URL('../', import.meta.url);
const read = url => JSON.parse(readFileSync(url, 'utf8'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const graph = read(new URL('../../../../database/seeds/kc_graph.v1.json', import.meta.url));
const oldBlueprint = read(new URL('../../../curriculum-recovery/financial-education/blueprint.json', import.meta.url));
const scope = read(new URL('../../../curriculum-design/financial-education/scope.json', import.meta.url));

export function collectProduction() {
  const plans = [adoptOpening(0), adoptOpening(1), adoptOpening(2), commitment, capacity, dates, borrowing, transfers,
    uncertainIncome, reviewPayments, reviewChanges, ...foundations.buildPlans(resolveSkill), ...money.buildPlans(resolveSkill),
    ...future.buildPlans(resolveSkill), ...integrated.buildPlans(resolveSkill)].map(plan => structuredClone(plan));
  const ids = new Set();
  const orderedIds = sequence.lessons.map(row => row.lesson_id);
  const units = [], unitByLesson = new Map();
  for (const domain of scope.domains) {
    const lessons = sequence.lessons.filter(row => row.domain === domain.id);
    const parts = Math.ceil(lessons.length / 6);
    const size = Math.floor(lessons.length / parts), extra = lessons.length % parts;
    let cursor = 0;
    for (let part = 0; part < parts; part++) {
      const id = `fe-production-${domain.id}-part-${part + 1}`;
      const count = size + (part < extra ? 1 : 0);
      units.push({ id, title: Object.fromEntries(Object.entries(unitTitles[domain.id]).map(([locale, title]) => [locale, `${title} ${part + 1}`])), objective: domain.outcomes.join(' ') });
      for (const lesson of lessons.slice(cursor, cursor + count)) unitByLesson.set(lesson.lesson_id, id);
      cursor += count;
    }
  }
  const skillDesign = new Map(sequence.lessons.filter(row => row.kind === 'teach').map(row => [resolveSkill(row.lesson_id), row]));
  for (const plan of plans) {
    if (!orderedIds.includes(plan.lesson_id) || ids.has(plan.lesson_id)) throw new Error(`Unknown or duplicate authored lesson ${plan.lesson_id}`);
    ids.add(plan.lesson_id);
    plan.chapter_id = unitByLesson.get(plan.lesson_id);
    const compactTitle = compactEnglishTitle(plan.lesson_id);
    if (compactTitle) plan.title['en-US'] = compactTitle;
    const teaching = skillDesign.get(plan.instruction.objective.skill_id);
    if (!teaching) throw new Error(`Unmapped primary skill in ${plan.lesson_id}`);
    // The canonical mapping adds previously taught shared preparation explicitly.
    plan.instruction.prerequisite_skills = prerequisiteSkills(teaching);
    plan.instruction.delayed_retrieval.fresh_context = 'Retrieve this competence in the declared later course reviews and through the existing shared review system.';
  }
  plans.sort((a,b) => orderedIds.indexOf(a.lesson_id) - orderedIds.indexOf(b.lesson_id));
  const byId = new Map(plans.map(plan => [plan.lesson_id, plan]));
  const metadata = new Map([...(foundations.metadata ?? []), ...(money.proposedSkills ?? []), ...(future.proposedSkills ?? [])]
    .map(row => [row.lesson_id, row]));
  const existing = new Set(graph.kcs.map(row => row.key));
  const proposedNodes = [], missingTranslations = [];
  for (const design of sequence.lessons.filter(row => row.kind === 'teach')) {
    const key = `finance.${resolveSkill(design.lesson_id)}`;
    if (existing.has(key)) continue;
    const plan = byId.get(design.lesson_id), meta = metadata.get(design.lesson_id);
    const objective = meta?.objective_i18n ?? meta?.objective;
    if (!plan || !objective || typeof objective !== 'object' || ['en-US','es-MX','pt-BR'].some(locale => typeof objective[locale] !== 'string' || objective[locale].length < 15)) {
      missingTranslations.push(design.lesson_id); continue;
    }
    if (objective['en-US'] !== design.objective) throw new Error(`KC objective differs from curriculum: ${design.lesson_id}`);
    const strand = ['investing-foundations', 'investment-comparison', 'retirement-future'].includes(design.domain) ? 'investing'
      : ['financial-math', 'time-inflation'].includes(design.domain) ? 'money_math' : 'money_life';
    proposedNodes.push({ key, strand, tier_min: 3, p_l0: 0.25, p_t: 0.15, p_g: 0.2, p_s: 0.1,
      title: plan.title, objective, skill_key: null, status: 'draft' });
  }
  const blueprint = {
    version: 1, publication_intent: 'release-candidate', course_id: 'financial-education', pathway_id: 'financial-adult', age_band: 'adult',
    metadata: oldBlueprint.metadata,
    scope: 'A broad introductory adult personal-finance course: usable money and arithmetic, income and budgets, payments and purchases, resilience and credit, protection and investing, public systems and long-term household decisions. Specialist professional knowledge remains outside this course.',
    excluded_scope: scope.boundaries,
    units,
    sources: scope.sources.map(({url,use}) => ({url,use})),
    skills: sequence.lessons.filter(row => row.kind === 'teach').map(row => ({ id: resolveSkill(row.lesson_id), knowledge_component_id: `finance.${resolveSkill(row.lesson_id)}`,
      domain: row.domain, outcome: row.objective, prerequisites: prerequisiteSkills(row) })),
    lessons: sequence.lessons.map(row => ({ lesson_id: row.lesson_id, primary_skill: byId.get(row.lesson_id)?.instruction.objective.skill_id
      ?? (row.kind === 'teach' ? resolveSkill(row.lesson_id) : resolveSkill(row.retrieve_objectives[0])),
      unit_id: unitByLesson.get(row.lesson_id), kind: row.kind, retrieve_skills: row.retrieve_objectives.map(resolveSkill) })),
  };
  return { plans, blueprint, proposedNodes, missingTranslations, missingLessons: orderedIds.filter(id => !ids.has(id)) };
}

export function writeProduction({ draft = false } = {}) {
  const collected = collectProduction();
  const copyProblems = storyCopyProblems(collected.plans);
  if (copyProblems.length) throw new Error(`Story screens exceed the authored text plus player labels budget: ${JSON.stringify(copyProblems)}`);
  if (!draft && (collected.missingLessons.length || collected.missingTranslations.length)) {
    throw new Error(`Complete production source unavailable: ${collected.missingLessons.length} lessons and ${collected.missingTranslations.length} localized KC definitions missing. Use --draft only for a non-releasable integration snapshot.`);
  }
  const destination = new URL(draft ? 'integration-draft/' : 'complete-source/', root);
  const directory = new URL('plans/', destination);
  mkdirSync(directory, {recursive:true});
  const lessonHashes = [];
  for (const plan of collected.plans) {
    const text = JSON.stringify(plan,null,2)+'\n';
    writeFileSync(new URL(`${plan.lesson_id}.json`, directory), text);
    lessonHashes.push({lesson_id:plan.lesson_id,sha256:hash(text)});
  }
  const save = (name,value) => writeFileSync(new URL(name,destination),JSON.stringify(value,null,2)+'\n');
  save('blueprint.json', collected.blueprint);
  save('proposed-kcs.json', collected.proposedNodes);
  save('skill-mapping.json', {mapping:skillMapping,reconciliation:skillReconciliation});
  const manifest = { version:1, status:draft?'non-releasable-integration-draft':'complete-source-awaiting-validation',
    planned_lessons:sequence.lessons.length, authored_lessons:collected.plans.length,
    missing_lessons:collected.missingLessons, missing_localized_kcs:collected.missingTranslations,
    whole_course_complete:!collected.missingLessons.length, publication_verified:false,
    owner_authorization:'Generate and publish the complete course using multiagents; authorization does not certify missing release evidence.',
    design_sha256:hash(readFileSync(new URL('../../../curriculum-design/financial-education/lesson-sequence.json',import.meta.url),'utf8')),
    adopted_calibration_sources:adoptedSources, lessons:lessonHashes,
    calls:{model:0,image:0,voice:0,network:0,publication:0} };
  save('manifest.json',manifest);
  return {authored:manifest.authored_lessons,planned:manifest.planned_lessons,missing:manifest.missing_lessons.length,
    missingLocalizedKcs:manifest.missing_localized_kcs.length,destination:fileURLToPath(destination),published:false};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(writeProduction({draft:process.argv.includes('--draft')})));
