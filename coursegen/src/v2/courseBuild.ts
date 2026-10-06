import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { courseBlueprintSchema, checkCourseBlueprint } from './courseBlueprint.js';
import { loadV2Plans } from './plan.js';
import { emitV2Lesson, forgeVersionId } from './emit.js';
import { authoringMessages, authoringCourseContext, skeletonOf } from './author.js';
import { buildHierarchy, renderRowsJson, renderIdsJson, renderSql, type KcInfo } from './hierarchy.js';
import { MIN_MISJUDGMENT_EPISODES_PER_COURSE } from '../contentGates/misjudgment.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Provider-independent offline compilation. An incomplete course emits no releasable corpus. */
export function buildCourse(blueprintFile: string, plansDirectory: string, outDirectory: string) {
  const inside = (parent: string, child: string) => {
    const relative = path.relative(path.resolve(parent), path.resolve(child));
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  };
  if (inside(plansDirectory, outDirectory) || inside(outDirectory, plansDirectory) || inside(outDirectory, blueprintFile)) throw new Error('Output must be separate from curriculum source files.');
  mkdirSync(outDirectory, { recursive: true });
  // Invalidate previous output even when parsing the new source fails.
  writeFileSync(path.join(outDirectory, 'documents.json'), '[]\n');
  writeFileSync(path.join(outDirectory, 'authoring-packets.json'), '[]\n');
  writeFileSync(path.join(outDirectory, 'hierarchy.json'), '{}\n');
  writeFileSync(path.join(outDirectory, 'lesson-ids.json'), '{}\n');
  writeFileSync(path.join(outDirectory, 'hierarchy.sql'), '-- Incomplete build: no hierarchy emitted.\n');
  writeFileSync(path.join(outDirectory, 'report.json'), `${JSON.stringify({ ok: false, problems: [{ code: 'incomplete-build', message: 'Build has not finished; inspect the command error.' }] }, null, 2)}\n`);
  const blueprint = courseBlueprintSchema.parse(JSON.parse(readFileSync(blueprintFile, 'utf8')));
  const loaded = loadV2Plans(plansDirectory);
  const curriculumOrder = new Map(blueprint.lessons.map((lesson, index) => [lesson.lesson_id, index]));
  const plans = loaded.flatMap(item => item.plan ? [item.plan] : []).sort((a, b) =>
    (curriculumOrder.get(a.lesson_id) ?? Infinity) - (curriculumOrder.get(b.lesson_id) ?? Infinity)
    || a.lesson_id.localeCompare(b.lesson_id));
  const graph = JSON.parse(readFileSync(path.resolve(packageRoot, '../database/seeds/kc_graph.v1.json'), 'utf8')) as { kcs: Array<KcInfo & { key: string }>; edges: string[][] };
  const problems = [
    ...loaded.flatMap(item => item.errors.map(message => ({ code: 'invalid-plan', message: `${item.file}: ${message}` }))),
    ...checkCourseBlueprint(blueprint, plans, new Set(graph.kcs.map(kc => kc.key)), graph.edges),
  ];
  if (plans.filter(plan => plan.mentor_misjudgment).length < MIN_MISJUDGMENT_EPISODES_PER_COURSE) {
    problems.push({ code: 'missing-mentor-recovery', message: 'The complete course must visibly stage a Mentor mistake and its correction; metadata alone does not satisfy the lesson emitter.' });
  }
  const inputHash = hash({ blueprint, plans });
  const runId = `course-${inputHash.slice(0, 20)}`;
  const results = plans.map(plan => emitV2Lesson(plan, { versionId: forgeVersionId(runId), requireLessonDesign: true }));
  for (const result of results) for (const finding of result.problems) problems.push({ code: `gate-${finding.gate}`, message: `${result.lessonId}: ${finding.message}` });
  const ok = problems.length === 0;
  const documents = ok ? results.flatMap(result => result.documents) : [];
  const review = results.flatMap(result => result.review.map(finding => ({ lessonId: result.lessonId, ...finding })));
  if (ok) {
    const hierarchy = buildHierarchy({
      structure: { course_id: blueprint.course_id, pathways: [{ pathway_id: blueprint.pathway_id, age_band: blueprint.age_band,
        chapters: blueprint.units.map(unit => ({ chapter_id: unit.id, title: unit.title, lessons: blueprint.lessons.filter(lesson => lesson.unit_id === unit.id).map(lesson => ({ lesson_id: lesson.lesson_id })) })),
      }] },
      plans, kcs: Object.fromEntries(graph.kcs.map(kc => [kc.key, kc])), metadata: blueprint.metadata,
    });
    writeFileSync(path.join(outDirectory, 'hierarchy.json'), renderRowsJson(hierarchy));
    writeFileSync(path.join(outDirectory, 'lesson-ids.json'), renderIdsJson(hierarchy));
    writeFileSync(path.join(outDirectory, 'hierarchy.sql'), renderSql(hierarchy));
  }
  const report = {
    version: 1, ok, inputHash, documentsHash: hash(documents), runId,
    courseId: blueprint.course_id, pathwayId: blueprint.pathway_id,
    publicationIntent: blueprint.publication_intent ?? 'unclassified',
    plannedLessons: blueprint.lessons.length, authoredLessons: plans.length, emittedDocuments: documents.length,
    problems, review,
    acceptance: 'not established; technical compilation does not certify teaching quality, retention or release',
    calls: { model: 0, image: 0, voice: 0, network: 0, publication: 0 },
  };
  mkdirSync(outDirectory, { recursive: true });
  writeFileSync(path.join(outDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  // Always replace old output: a failed build must not leave a stale successful corpus beside its report.
  writeFileSync(path.join(outDirectory, 'documents.json'), `${JSON.stringify(documents, null, 2)}\n`);
  writeFileSync(path.join(outDirectory, 'authoring-packets.json'), `${JSON.stringify(plans.map(plan => ({
    lessonId: plan.lesson_id,
    inputHash,
    courseContext: authoringCourseContext(blueprint, plan.lesson_id),
    messages: authoringMessages(skeletonOf(plan), [], authoringCourseContext(blueprint, plan.lesson_id)),
  })), null, 2)}\n`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const readArg = (name: string): string => {
    const index = args.indexOf(name);
    if (index < 0 || !args[index + 1] || args[index + 1]!.startsWith('--')) throw new Error(`Required: ${name} <path>`);
    return path.resolve(args[index + 1]!);
  };
  try {
    const report = buildCourse(readArg('--blueprint'), readArg('--plans'), readArg('--out'));
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`course:build: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
