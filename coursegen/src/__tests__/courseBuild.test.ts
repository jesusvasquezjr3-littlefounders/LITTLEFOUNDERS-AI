import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCourse } from '../v2/courseBuild.js';
import { checkCourseBlueprint, courseBlueprintSchema } from '../v2/courseBlueprint.js';
import { loadV2Plans } from '../v2/plan.js';
import { releaseV2Lessons } from '../v2/release.js';
import { loadCourseReleaseSource } from '../v2/courseReleaseSource.js';
import { emitV2Lesson } from '../v2/emit.js';
import { evaluateV2Release } from '../v2/releaseVerify.js';
import { authorV2Plan, authoringCourseContext, fixtureResponder, skeletonOf } from '../v2/author.js';
const source = fileURLToPath(new URL('../../curriculum-recovery/financial-education/', import.meta.url));
const folders: string[] = [];
const temp = () => { const value = mkdtempSync(path.join(tmpdir(), 'lf-course-')); folders.push(value); return value; };
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });

describe('complete provider-independent course compilation', () => {
  it('rebuilds authoring sources without rewriting shared KC parameters, activation or prerequisite edges', () => {
    const workspace = temp();
    const copy = path.join(workspace, 'coursegen/curriculum-recovery/financial-education');
    cpSync(source, copy, { recursive: true });
    const graphFile = path.join(workspace, 'database/seeds/kc_graph.v1.json');
    mkdirSync(path.dirname(graphFile), { recursive: true });
    const graph = json(fileURLToPath(new URL('../../../database/seeds/kc_graph.v1.json', import.meta.url)));
    const node = graph.kcs.find((row: { key: string }) => row.key === 'finance.cash.direction');
    node.status = 'active';
    node.p_l0 = 0.67;
    const before = JSON.stringify(graph, null, 2);
    writeFileSync(graphFile, before);
    execFileSync(process.execPath, [path.join(copy, 'authoring/build-source.mjs')], { cwd: workspace });
    expect(readFileSync(graphFile, 'utf8')).toBe(before);
    expect(json(path.join(copy, 'blueprint.json')).publication_intent).toBe('calibration-only');
  });
  it('preserves calibration intent in the authoring source as well as generated blueprint', async () => {
    const authored = await import(new URL('../../curriculum-recovery/financial-education/authoring/outline.mjs', import.meta.url).href);
    expect(courseBlueprintSchema.parse(authored.blueprint).publication_intent).toBe('calibration-only');
    expect(json(path.join(source, 'blueprint.json'))).toEqual(authored.blueprint);
  });
  it('preserves the whole authored course through the Forge copy adapter without a provider call', async () => {
    const blueprint = courseBlueprintSchema.parse(json(path.join(source, 'blueprint.json')));
    const plans = loadV2Plans(path.join(source, 'course-plans')).map(row => row.plan!);
    for (const plan of plans) {
      const result = await authorV2Plan(skeletonOf(plan), fixtureResponder(plan), {
        operation: 'v2-author', courseContext: authoringCourseContext(blueprint, plan.lesson_id), maxRounds: 1,
      });
      expect(result.problems, plan.lesson_id).toEqual([]);
      expect(result.plan, plan.lesson_id).toEqual(plan);
    }
  });
  it('emits in curriculum order even when authored filenames sort differently', () => {
    const draft = path.join(temp(), 'plans');
    cpSync(path.join(source, 'course-plans'), draft, { recursive: true });
    const blueprint = json(path.join(source, 'blueprint.json'));
    const firstId = blueprint.lessons[0].lesson_id;
    const first = json(path.join(draft, `${firstId}.json`));
    first.lesson_id = 'zz-opening-lesson';
    blueprint.lessons[0].lesson_id = first.lesson_id;
    rmSync(path.join(draft, `${firstId}.json`));
    writeFileSync(path.join(draft, `${first.lesson_id}.json`), JSON.stringify(first));
    const blueprintFile = path.join(temp(), 'blueprint.json');
    writeFileSync(blueprintFile, JSON.stringify(blueprint));
    const out = temp();
    expect(buildCourse(blueprintFile, draft, out).problems).toEqual([]);
    expect(json(path.join(out, 'documents.json'))[0].lesson_id).toBe('zz-opening-lesson');
    expect(json(path.join(out, 'authoring-packets.json'))[0].lessonId).toBe('zz-opening-lesson');
  });
  it('blocks an otherwise valid course when its Mentor recovery declaration is removed', () => {
    const draft = path.join(temp(), 'plans');
    cpSync(path.join(source, 'course-plans'), draft, { recursive: true });
    for (const row of loadV2Plans(draft)) {
      if (!row.plan?.mentor_misjudgment) continue;
      delete row.plan.mentor_misjudgment;
      writeFileSync(path.join(draft, row.file), JSON.stringify(row.plan));
    }
    const out = temp();
    const result = buildCourse(path.join(source, 'blueprint.json'), draft, out);
    expect(result.problems).toContainEqual(expect.objectContaining({ code: 'missing-mentor-recovery' }));
    expect(json(path.join(out, 'documents.json'))).toEqual([]);
  });
  it('verifies the exact new source and rejects a mismatched source before release', () => {
    const out = temp();
    buildCourse(path.join(source, 'blueprint.json'), path.join(source, 'course-plans'), out);
    const paths = { blueprint: path.join(source, 'blueprint.json'), plans: path.join(source, 'course-plans'), lessonIds: path.join(out, 'lesson-ids.json') };
    expect(() => loadCourseReleaseSource('financial-education', paths)).toThrow('Calibration-only');
    const selected = loadCourseReleaseSource('financial-education', paths, { allowCalibration: true });
    expect(selected.plans).toHaveLength(36);
    const candidate = json(paths.blueprint);
    const candidateFile = path.join(temp(), 'candidate-blueprint.json');
    delete candidate.publication_intent;
    writeFileSync(candidateFile, JSON.stringify(candidate));
    expect(() => loadCourseReleaseSource('financial-education', {...paths, blueprint:candidateFile})).toThrow('unclassified');
    candidate.publication_intent = 'release-candidate';
    writeFileSync(candidateFile, JSON.stringify(candidate));
    expect(loadCourseReleaseSource('financial-education', {...paths, blueprint:candidateFile}).plans).toHaveLength(36);
    expect(() => loadCourseReleaseSource('different-course', paths)).toThrow('differs');
    const hierarchy = json(path.join(out, 'hierarchy.json'));
    const current = selected.plans.flatMap(plan => emitV2Lesson(plan, { versionId: 'reviewed-source', requireLessonDesign: true }).documents);
    const result = evaluateV2Release({ ...selected, current,
      vaultLessons: hierarchy.tables.lessons.map((lesson: { id: string; slug: string }) => ({ ...lesson, status: 'review' })),
      topicTitles: hierarchy.tables.topics.map((topic: { title: unknown }) => topic.title),
      orphansWithProgress: [], orphanCount: 0, corePassed: true, coreDetail: 'Separate Core verification required',
    });
    expect(result.checks.filter(check => !check.ok)).toEqual([]);
    const ids = json(paths.lessonIds);
    const aliased = { ...ids, [Object.keys(ids)[0]!]: Object.values(ids)[1] };
    writeFileSync(paths.lessonIds, JSON.stringify(aliased));
    expect(() => loadCourseReleaseSource('financial-education', paths, { allowCalibration: true })).toThrow('distinct');
    delete ids[Object.keys(ids)[0]!];
    writeFileSync(paths.lessonIds, JSON.stringify(ids));
    expect(() => loadCourseReleaseSource('financial-education', paths, { allowCalibration: true })).toThrow('exactly');
  });
  it('refuses new strict wire fields before deployment confirmation without calling Vault', async () => {
    const plans = loadV2Plans(path.join(source, 'course-plans')).flatMap(row => row.plan ? [row.plan] : []);
    const rpc = vi.fn(async () => ({ ok: true, status: 200, body: { activation: 'activated' } }));
    const verifyCourse = vi.fn(() => ({ok: true, output: ''}));
    const deps = {coreCheck: () => ({ok: true, output: ''}), verifyCourse, rpc};
    const lesson = plans.find(plan => plan.lesson_id.startsWith('fe-solid-03-'))!;
    const options = {runId: 'deployment-check', outDir: temp(), courseSlug: 'financial-education', dryRun: false, deps};
    const refused = await releaseV2Lessons([lesson], options);
    expect(refused.ok).toBe(false);
    expect(refused.problems.join(' ')).toContain('--core-has-instructional-fields');
    expect(rpc).not.toHaveBeenCalled(); expect(verifyCourse).not.toHaveBeenCalled();
    expect((await releaseV2Lessons([lesson], {...options, dryRun: true})).ok).toBe(true);
    expect((await releaseV2Lessons([lesson], {...options, coreServesInstructionalFields: true})).ok).toBe(true);
  });
  it('builds the closed course, carries review links and keeps private evidence out of player documents', () => {
    const out = temp();
    const report = buildCourse(path.join(source, 'blueprint.json'), path.join(source, 'course-plans'), out);
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.authoredLessons).toBe(36);
    expect(report.publicationIntent).toBe('calibration-only');
    expect(report.emittedDocuments).toBe(108);
    expect(Object.values(report.calls).every(count => count === 0)).toBe(true);
    const documents = json(path.join(out, 'documents.json')) as Array<{ document: unknown }>;
    const publicText = JSON.stringify(documents.map(row => row.document));
    for (const secret of ['numeric_proof', 'supports_from', 'acceptable_choice_ids']) expect(publicText).not.toContain(secret);
    const hierarchy = json(path.join(out, 'hierarchy.json'));
    const reviews = hierarchy.tables.topics.filter((row: { kind: string }) => row.kind !== 'teaching');
    expect(reviews).toHaveLength(9);
    expect(reviews.every((row: { review_of: string[] }) => row.review_of.length >= 3)).toBe(true);
    const reviewIds = new Set(reviews.map((row: { id: string }) => row.id));
    const links = hierarchy.tables.topic_knowledge_components.filter((row: { topic_id: string }) => reviewIds.has(row.topic_id));
    expect(links.length).toBeGreaterThan(9);
    expect(links.every((row: { role: string; is_primary: boolean }) => row.role === 'reviews' && !row.is_primary)).toBe(true);
    expect(readFileSync(path.join(out, 'hierarchy.sql'), 'utf8')).toContain('ROLLBACK;');
    const again = buildCourse(path.join(source, 'blueprint.json'), path.join(source, 'course-plans'), out);
    expect(again.documentsHash).toBe(report.documentsHash);
  });

  it('invalidates previous release files when a subsequent source cannot even parse', () => {
    const out = temp();
    const invalid = path.join(temp(), 'blueprint.json');
    buildCourse(path.join(source, 'blueprint.json'), path.join(source, 'course-plans'), out);
    writeFileSync(invalid, '{broken');
    expect(() => buildCourse(invalid, path.join(source, 'course-plans'), out)).toThrow();
    expect(json(path.join(out, 'documents.json'))).toEqual([]);
    expect(json(path.join(out, 'lesson-ids.json'))).toEqual({});
    expect(json(path.join(out, 'report.json')).ok).toBe(false);
    expect(readFileSync(path.join(out, 'hierarchy.sql'), 'utf8')).not.toContain('INSERT');
  });

  it('blocks a missing transfer lesson instead of publishing the remaining valid lessons', () => {
    const draft = path.join(temp(), 'plans');
    cpSync(path.join(source, 'course-plans'), draft, { recursive: true });
    rmSync(path.join(draft, 'fe-solid-36-plan-a-new-month.json'));
    const out = temp();
    const report = buildCourse(path.join(source, 'blueprint.json'), draft, out);
    expect(report.ok).toBe(false);
    expect(report.problems.some(problem => problem.code === 'missing-plan')).toBe(true);
    expect(json(path.join(out, 'documents.json'))).toEqual([]);
  });

  it('detects shared-KC prerequisite drift and wrongly credited exercises', () => {
    const blueprint = courseBlueprintSchema.parse(json(path.join(source, 'blueprint.json')));
    const plans = loadV2Plans(path.join(source, 'course-plans')).flatMap(row => row.plan ? [row.plan] : []);
    const graph = json(fileURLToPath(new URL('../../../database/seeds/kc_graph.v1.json', import.meta.url)));
    const kcs = new Set<string>(graph.kcs.map((row: { key: string }) => row.key));
    const item = plans[0]!.segments.find(row => row.grading === 'server')!;
    item.knowledge_component_id = 'finance.debt.minimum';
    const issues = checkCourseBlueprint(blueprint, plans, kcs, [...graph.edges, ['finance.debt.minimum', 'finance.cash.direction']]);
    expect(issues.some(issue => issue.code === 'item-kc-drift')).toBe(true);
    expect(issues.some(issue => issue.code.includes('prerequisite'))).toBe(true);
  });

  it('allows earlier contextual preparation but still requires every shared prerequisite', () => {
    const blueprint = courseBlueprintSchema.parse(json(path.join(source, 'blueprint.json')));
    const plans = loadV2Plans(path.join(source, 'course-plans')).flatMap(row => row.plan ? [row.plan] : []);
    const graph = json(fileURLToPath(new URL('../../../database/seeds/kc_graph.v1.json', import.meta.url)));
    const kcs = new Set<string>(graph.kcs.map((row: { key: string }) => row.key));
    const skill = blueprint.skills.find(row => row.id === 'debt.obligation')!;
    const edges = graph.edges.filter((edge: string[]) => edge[1] !== skill.knowledge_component_id);
    edges.push(['finance.cash.balance', skill.knowledge_component_id]);
    expect(skill.prerequisites).toContain('plan.revise');
    expect(checkCourseBlueprint(blueprint, plans, kcs, edges)).toEqual([]);
    const plan = plans.find(row => row.instruction?.objective.skill_id === skill.id && row.instruction.kind === 'teach')!;
    skill.prerequisites.push('invest.horizon');
    plan.instruction!.prerequisite_skills = [...skill.prerequisites];
    expect(checkCourseBlueprint(blueprint, plans, kcs, edges)).toContainEqual(expect.objectContaining({ code: 'untaught-prerequisite' }));
    skill.prerequisites = skill.prerequisites.filter(key => key !== 'invest.horizon');
    skill.prerequisites = skill.prerequisites.filter(key => key !== 'cash.balance');
    plan.instruction!.prerequisite_skills = [...skill.prerequisites];
    expect(checkCourseBlueprint(blueprint, plans, kcs, edges)).toContainEqual(expect.objectContaining({ code: 'shared-prerequisite-drift' }));
  });

  it('checks a 360-lesson graph without confusing independent unit identities (engineering fixture, not a quality catalog)', () => {
    const original = courseBlueprintSchema.parse(json(path.join(source, 'blueprint.json')));
    const originals = loadV2Plans(path.join(source, 'course-plans')).flatMap(row => row.plan ? [row.plan] : []);
    const large = structuredClone(original);
    large.units = []; large.skills = []; large.lessons = [];
    const plans: typeof originals = [];
    for (const suffix of 'abcdefghij') {
      const key = (value: string) => `${value}-${suffix}`;
      large.units.push(...original.units.map(unit => ({ ...unit, id: key(unit.id) })));
      large.skills.push(...original.skills.map(skill => ({ ...skill, id: key(skill.id), knowledge_component_id: key(skill.knowledge_component_id), prerequisites: skill.prerequisites.map(key) })));
      large.lessons.push(...original.lessons.map(lesson => ({ ...lesson, lesson_id: key(lesson.lesson_id), unit_id: key(lesson.unit_id), primary_skill: key(lesson.primary_skill), retrieve_skills: lesson.retrieve_skills.map(key) })));
      for (const sourcePlan of originals) {
        const plan = structuredClone(sourcePlan);
        plan.lesson_id = key(plan.lesson_id); plan.chapter_id = key(plan.chapter_id);
        plan.knowledge_component_ids = plan.knowledge_component_ids.map(key);
        plan.new_concepts = plan.new_concepts.map(key);
        const instruction = plan.instruction!;
        instruction.objective.skill_id = key(instruction.objective.skill_id);
        instruction.prerequisite_skills = instruction.prerequisite_skills.map(key);
        instruction.retrieval_skills = instruction.retrieval_skills.map(key);
        instruction.delayed_retrieval.skill_id = key(instruction.delayed_retrieval.skill_id);
        for (const evidence of instruction.evidence) evidence.skill_id = key(evidence.skill_id);
        for (const segment of plan.segments) {
          if (segment.knowledge_component_id) segment.knowledge_component_id = key(segment.knowledge_component_id);
          // Unique engineering marker, explicitly not authored learner content.
          if (segment.teaching_role === 'hook') for (const copy of Object.values(segment.copy)) copy.line = `${copy.line} Fixture ${suffix}`;
        }
        plans.push(plan);
      }
    }
    const keys = new Set(large.skills.map(skill => skill.knowledge_component_id));
    const mapping = new Map(large.skills.map(skill => [skill.id, skill.knowledge_component_id]));
    const edges = large.skills.flatMap(skill => skill.prerequisites.map(pre => [mapping.get(pre)!, skill.knowledge_component_id]));
    expect(plans).toHaveLength(360);
    expect(checkCourseBlueprint(large, plans, keys, edges)).toEqual([]);
    // Changing only names/numbers must not turn copied learner content into a valid large catalog.
    plans[36]!.segments = structuredClone(plans[0]!.segments);
    expect(checkCourseBlueprint(large, plans, keys, edges).some(issue => issue.code === 'duplicate-lesson-content')).toBe(true);
  });
});
