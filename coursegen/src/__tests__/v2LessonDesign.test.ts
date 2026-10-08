// Pilot round 2: the examples-first lesson-design gate (gate 14, lessonDesign.ts)
// and the writing skills the v2 authoring prompt now carries (writingSkills.ts).
// The gate reads only plan annotations, so these plans are minimal and typed
// loosely; the emitter test covers real documents.

import { describe, expect, it } from 'vitest';
import { CONTENT_PLAYBOOK, FOLLOWABILITY_RULES, PLAYBOOK_RULES } from '../pipeline/contentPlaybook.js';
import { authoringMessages, skeletonOf } from '../v2/author.js';
import { analyzeV2Plan } from '../v2/gates.js';
import { checkLessonDesign, summarizeLessonDesign } from '../v2/lessonDesign.js';
import { FIXTURE_PLANS } from '../v2/cli.js';
import { loadV2Plans, type V2LessonPlan, type V2TeachingRole } from '../v2/plan.js';
import { LOCALE_STYLE, MENTOR_VOICES, PILOT_LESSONS, writingSkillsPrompt } from '../v2/writingSkills.js';

type Row = [role: V2TeachingRole, extra?: Record<string, unknown>];

function plan(rows: Row[], overrides: Record<string, unknown> = {}): V2LessonPlan {
  return {
    new_concepts: ['kc-a'],
    eligibility: { minimum_age: 8, maximum_age: 9 },
    age_band: '6-9',
    segments: rows.map(([role, extra], index) => {
      const graded = role !== 'hook' && role !== 'example';
      return {
        id: `s${index + 1}-${role}`,
        type: graded ? 'money.coin-tray.v2' : 'voice.mentor-turn.v2',
        grading: graded ? 'server' : 'none',
        teaching_role: role,
        ...(role === 'pre' ? { item_phase: 'pre' } : {}),
        ...(role === 'transfer' ? { item_phase: 'post' } : {}),
        ...(role === 'transfer' ? { item_role: 'transfer' } : graded ? { item_role: 'practice' } : {}),
        ...extra,
      };
    }),
    ...overrides,
  } as unknown as V2LessonPlan;
}

const sound: Row[] = [['hook'], ['pre'], ['example'], ['example'], ['guided'], ['guided'], ['practice'], ['transfer']];
const messages = (findings: ReturnType<typeof checkLessonDesign>) => findings.map((finding) => `${finding.severity}: ${finding.message}`);

describe('lesson design gate (gate 14)', () => {
  it('passes an examples-first arc: hook, pre, examples, guided, practice, transfer', () => {
    expect(checkLessonDesign(plan(sound), { required: true })).toEqual([]);
  });

  it('skips a plan that declares no roles unless the run requires them', () => {
    const undeclared = plan([['practice'], ['transfer']]);
    for (const segment of undeclared.segments) delete (segment as { teaching_role?: string }).teaching_role;
    expect(checkLessonDesign(undeclared)).toEqual([]);
    expect(messages(checkLessonDesign(undeclared, { required: true }))[0]).toContain('names no teaching_role');
  });

  it('blocks an exercise that comes before the first example', () => {
    const found = messages(checkLessonDesign(plan([['hook'], ['practice'], ['example'], ['guided'], ['transfer']])));
    expect(found.some((line) => line.startsWith('block') && line.includes('comes before the first example'))).toBe(true);
  });

  it('blocks a lesson that introduces a concept and demonstrates none', () => {
    const found = messages(checkLessonDesign(plan([['hook'], ['guided'], ['practice'], ['transfer']])));
    expect(found.some((line) => line.includes('demonstrates none'))).toBe(true);
  });

  it('blocks a pre item placed after teaching began, and a lesson with no transfer', () => {
    const late = messages(checkLessonDesign(plan([['hook'], ['example'], ['pre'], ['guided'], ['practice'], ['transfer']])));
    expect(late.some((line) => line.includes('placed after teaching began'))).toBe(true);
    const none = messages(checkLessonDesign(plan([['hook'], ['example'], ['guided'], ['practice']])));
    expect(none.some((line) => line.includes('no transfer item') || line.includes('ends its graded run'))).toBe(true);
  });

  it('blocks a missing pre/post tag, so the learning gain stays computable', () => {
    const untagged = plan(sound);
    delete (untagged.segments.find((segment) => segment.teaching_role === 'pre') as { item_phase?: string }).item_phase;
    expect(messages(checkLessonDesign(untagged)).some((line) => line.includes('lacks item_phase "pre"'))).toBe(true);
  });

  it('blocks an exercise-led lesson and reviews one that leans on exercises', () => {
    const led = plan([['hook'], ['example'], ['practice'], ['practice'], ['practice'], ['practice'], ['transfer']]);
    expect(messages(checkLessonDesign(led)).some((line) => line.startsWith('block') && line.includes('exercise-led'))).toBe(true);
    const leaning = plan([['hook'], ['example'], ['example'], ['guided'], ['practice'], ['practice'], ['practice'], ['transfer']]);
    const reviewed = checkLessonDesign(leaning);
    expect(reviewed.some((finding) => finding.severity === 'review' && finding.message.includes('leans on exercises'))).toBe(true);
    expect(reviewed.some((finding) => finding.severity === 'block')).toBe(false);
  });

  it('reviews a long run of demonstrations and blocks an absurd one', () => {
    const review = checkLessonDesign(plan([['hook'], ['example'], ['example'], ['example'], ['example'], ['guided'], ['practice'], ['transfer']]));
    expect(review.some((finding) => finding.severity === 'review' && finding.message.includes('examples in a row'))).toBe(true);
    const block = checkLessonDesign(plan([['hook'], ...Array.from({ length: 6 }, (): Row => ['example']), ['guided'], ['practice'], ['transfer']]));
    expect(block.some((finding) => finding.severity === 'block' && finding.message.includes('examples in a row'))).toBe(true);
  });

  it('summarises the arc the round report prints', () => {
    const summary = summarizeLessonDesign(plan(sound));
    expect(summary).toMatchObject({ declared: true, demonstrations: 4, independentExercises: 2, exerciseToDemonstration: 0.5, hasPre: true, hasPost: true });
  });

  it('rides gate 14 through analyzeV2Plan on a committed plan, and the committed plans are unaffected', () => {
    for (const entry of loadV2Plans(FIXTURE_PLANS)) {
      const findings = analyzeV2Plan(entry.plan!).findings.filter((finding) => finding.gate === 14 && /teaching_role|examples|pre item|transfer/.test(finding.message));
      expect(findings).toEqual([]);
    }
  });
});

describe('v2 writing skills', () => {
  const lesson = loadV2Plans(FIXTURE_PLANS)[0]!.plan!;
  const withRoles: V2LessonPlan = { ...lesson, mentor_stage: { character: 'rho', scene: 'diorama-a' }, segments: lesson.segments.map((segment) => ({ ...segment, teaching_role: 'practice' as const })) };

  it('reuses the v1 playbook rules verbatim, and leaves the v1 prompt unchanged', () => {
    const prompt = writingSkillsPrompt(withRoles).join('\n');
    for (const number of [1, 5, 6, 12, 2, 3]) expect(prompt).toContain(PLAYBOOK_RULES.find((rule) => rule.startsWith(`${number}. `))!);
    expect(prompt).not.toContain(PLAYBOOK_RULES.find((rule) => rule.startsWith('4. '))!);
    for (const rule of FOLLOWABILITY_RULES.filter((entry) => !entry.startsWith('2. '))) expect(prompt).toContain(rule);
    expect(CONTENT_PLAYBOOK.split('\n').filter((line) => /^\d+\. /.test(line))).toHaveLength(PLAYBOOK_RULES.length);
  });

  it('puts examples before exercises and states the Copy Budget as numbers per market', () => {
    const prompt = writingSkillsPrompt(withRoles).join('\n');
    expect(prompt.indexOf('EXAMPLES FIRST')).toBeLessThan(prompt.indexOf('WRITING CRAFT'));
    expect(prompt).toContain('a prompt es-MX 15, en-US 12, pt-BR 15');
    expect(prompt).toContain('an option label es-MX 7, en-US 5, pt-BR 7');
  });

  it('carries the pilot lessons, after the teaching order and before the craft', () => {
    const prompt = writingSkillsPrompt(withRoles).join('\n');
    for (const rule of PILOT_LESSONS) expect(prompt).toContain(rule);
    expect(prompt.indexOf('THE EXAMPLE SHOWS WHAT THE EXERCISE GRADES')).toBeGreaterThan(prompt.indexOf('EXAMPLES FIRST'));
    expect(prompt.indexOf('THE EXAMPLE SHOWS WHAT THE EXERCISE GRADES')).toBeLessThan(prompt.indexOf('WRITING CRAFT'));
  });

  it('describes only the roles the skeleton uses', () => {
    const prompt = writingSkillsPrompt(withRoles).join('\n');
    expect(prompt).toContain('role practice:');
    expect(prompt).not.toContain('role pre:');
  });

  it('treats adult beginners as novices without imposing a child narrative', () => {
    const adult = { ...withRoles, age_band: 'adult' as const, eligibility: { minimum_age: 18, maximum_age: 119 } };
    const prompt = writingSkillsPrompt(adult).join('\n');
    expect(prompt).toContain('Adult age does not imply knowledge of payslips');
    expect(prompt).toContain('same explicit teaching support as any novice');
    expect(prompt).toContain('without requiring a fictional cast');
    expect(prompt).not.toContain('one example, then straight to their own numbers');
    expect(prompt).not.toContain('role practice: reaffirm only. The move just shown and practised, a fresh instance, no new idea. `met` names the action the child');
  });

  it('gives every Mentor a distinct voice and the market styles differ', () => {
    const voices = Object.values(MENTOR_VOICES).map((entry) => entry.teachesBy);
    expect(new Set(voices).size).toBe(4);
    expect(new Set(Object.values(LOCALE_STYLE)).size).toBe(3);
    expect(writingSkillsPrompt(withRoles).join('\n')).toContain('Dr. Rho');
  });

  it('reaches the model: the system prompt carries the skills, the user prompt names each role', () => {
    const [system, user] = authoringMessages(skeletonOf(withRoles));
    expect(system!.content).toContain('EXAMPLES FIRST');
    expect(user!.content).toContain('practice, graded on Core');
  });
});
