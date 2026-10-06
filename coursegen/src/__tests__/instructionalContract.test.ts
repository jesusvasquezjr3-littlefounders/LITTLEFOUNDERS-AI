import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { v2LessonPlanSchema, type V2LessonPlan } from '../v2/plan.js';
import { checkInstructionalContract, instructionalContractSchema } from '../v2/instructionalContract.js';
import { checkCourseBlueprint, type CourseBlueprint } from '../v2/courseBlueprint.js';
import { authoringMessages, skeletonOf } from '../v2/author.js';
import { emitV2Lesson } from '../v2/emit.js';

function lesson(): V2LessonPlan {
  const plan = v2LessonPlanSchema.parse(JSON.parse(readFileSync(new URL('../../curriculum-recovery/financial-education/plans/fe-recovery-adult-01-money-moves.json', import.meta.url), 'utf8')));
  plan.instruction = instructionalContractSchema.parse({
    version: 1,
    objective: { skill_id: 'cash.direction', observable_action: 'Classify a payment from the named person perspective.', success_criterion: 'Identify the direction in an unfamiliar refund situation.' },
    prerequisite_skills: [], relevance: 'Know what changed before planning a purchase.', misconception: 'Confusing the person receiving money with the person paying.',
    numeracy_support: 'No arithmetic operation is required for this lesson.',
    evidence: plan.segments.filter(segment => segment.teaching_role !== 'hook').map(segment => ({ segment_id: segment.id, skill_id: 'cash.direction', context_id: segment.id, supports_from: segment.teaching_role === 'guided' ? ['example-in'] : [], reasoning: 'Follow who receives or gives the payment, rather than the object exchanged.' })),
    delayed_retrieval: { skill_id: 'cash.direction', fresh_context: 'Revisit money direction in a later bill and refund comparison.' },
  });
  return plan;
}

describe('instructional evidence shared across authoring providers', () => {
  it('requires evidence in the new course workflow while allowing legacy diagnostics', () => {
    const plan = lesson(); delete plan.instruction;
    expect(checkInstructionalContract(plan)).toEqual([]);
    expect(checkInstructionalContract(plan, true)[0]?.message).toContain('Missing instructional contract');
  });
  it('accepts a complete instructional chain and passes the same contract into Forge prompts', () => {
    const plan = lesson();
    expect(checkInstructionalContract(plan, true)).toEqual([]);
    const messages = authoringMessages(skeletonOf(plan));
    expect(JSON.stringify(messages)).toContain('cash.direction');
    expect(JSON.stringify(messages)).toContain('Do not claim mastery');
    expect(JSON.stringify(messages)).toContain('Exercise facts for the author only');
    expect(JSON.stringify(messages)).toContain('acceptable_choice_ids');
  });
  it.each(['missing-example', 'future-support', 'undeclared-skill', 'same-context', 'missing-feedback'] as const)('blocks %s even when the original document is otherwise valid', mutation => {
    const plan = lesson();
    const contract = plan.instruction!;
    if (mutation === 'missing-example') plan.segments = plan.segments.filter(segment => segment.teaching_role !== 'example');
    if (mutation === 'future-support') contract.evidence.find(item => item.segment_id === 'guided-01')!.supports_from = ['transfer-01'];
    if (mutation === 'undeclared-skill') contract.evidence[0]!.skill_id = 'untaught.percentages';
    if (mutation === 'same-context') contract.evidence.find(item => item.segment_id === 'transfer-01')!.context_id = contract.evidence[0]!.context_id;
    if (mutation === 'missing-feedback') delete plan.segments.find(segment => segment.grading === 'server')!.copy['es-MX'].feedback;
    expect(checkInstructionalContract(plan, true).length).toBeGreaterThan(0);
    expect(emitV2Lesson(plan, { versionId: 'instructional-test' }).ok).toBe(false);
  });
  it('does not expose private reasoning metadata or rubrics in public documents', () => {
    const result = emitV2Lesson(lesson(), { versionId: 'instructional-test' });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.documents.map(row => row.document))).not.toContain('supports_from');
    expect(JSON.stringify(result.documents.map(row => row.document))).not.toContain('acceptable_choice_ids');
  });
});

describe('course coverage is distinct from individual lesson validity', () => {
  function blueprint(): CourseBlueprint {
    return { version: 1, course_id: 'financial-education', pathway_id: 'financial-adult', age_band: 'adult', scope: 'Recognize incoming and outgoing payments before making a plan.', excluded_scope: ['Investment advice'], units: [{ id: lesson().chapter_id, title: lesson().title, objective: 'Track completed payments before planning a purchase.' }], sources: [{ url: 'https://www.fdic.gov/consumer-resource-center/money-smart-adults', use: 'Coverage reference for income and expenses.' }], skills: [{ id: 'cash.direction', knowledge_component_id: 'life.track-earnings', domain: 'cash-flow', outcome: 'Classify a payment from the named person perspective.', prerequisites: [] }], lessons: [{ lesson_id: lesson().lesson_id, primary_skill: 'cash.direction', unit_id: lesson().chapter_id, kind: 'teach', retrieve_skills: [] }] };
  }
  const kcs = new Set(['life.track-earnings']);
  it('refuses to certify a good isolated lesson as a complete course', () => {
    const codes = checkCourseBlueprint(blueprint(), [lesson()], kcs).map(issue => issue.code);
    expect(codes).toContain('unrevisited-skill');
    expect(codes).toContain('missing-capstone');
  });
  it('detects circular, unknown and out-of-order prerequisites', () => {
    const course = blueprint();
    course.skills[0]!.prerequisites = ['cash.direction', 'missing.skill'];
    const codes = checkCourseBlueprint(course, [lesson()], kcs).map(issue => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['prerequisite-cycle', 'unknown-prerequisite', 'untaught-prerequisite', 'prerequisite-drift']));
  });
  it('does not accept declared recall without a real independent exercise', () => {
    const course = blueprint();
    course.lessons.push({ lesson_id: 'later-review', primary_skill: 'cash.direction', unit_id: lesson().chapter_id, kind: 'consolidate', retrieve_skills: ['cash.direction'] });
    const later = lesson(); later.lesson_id = 'later-review';
    later.instruction!.evidence = later.instruction!.evidence.filter(item => !['practice-01', 'practice-02', 'practice-03', 'transfer-01'].includes(item.segment_id));
    const codes = checkCourseBlueprint(course, [lesson(), later], kcs).map(issue => issue.code);
    expect(codes).toContain('unspaced-retrieval');
    expect(codes).toContain('missing-retrieval-evidence');
  });
  it('rejects missing plans and unknown shared KCs rather than silently shrinking coverage', () => {
    const codes = checkCourseBlueprint(blueprint(), [], new Set()).map(issue => issue.code);
    expect(codes).toContain('missing-plan'); expect(codes).toContain('unknown-kc');
  });
});
