import { readFileSync } from 'node:fs';
import { courseBlueprintSchema, checkCourseBlueprint } from './courseBlueprint.js';
import { loadKcGraph, type CatalogStructure } from './catalogCheck.js';
import { loadV2Plans } from './plan.js';
import { applyLessonIds, parseLessonIds } from './hierarchy.js';

export interface CourseReleaseSourcePaths { blueprint: string; plans: string; lessonIds: string }

/** Resolve the exact reviewed source before any Vault read or attestation. */
export function loadCourseReleaseSource(course: string, paths: CourseReleaseSourcePaths, options: { allowCalibration?: boolean } = {}) {
  const blueprint = courseBlueprintSchema.parse(JSON.parse(readFileSync(paths.blueprint, 'utf8')));
  if (blueprint.course_id !== course) throw new Error('Release blueprint course differs from the requested course.');
  if (!options.allowCalibration && blueprint.publication_intent !== 'release-candidate') throw new Error('Calibration-only or unclassified blueprints cannot be published or attested as a release. Build and review a separate release-candidate curriculum first.');
  const loaded = loadV2Plans(paths.plans);
  const errors = loaded.flatMap(row => row.errors);
  if (errors.length) throw new Error(errors.join('; '));
  const plans = loaded.map(row => row.plan!);
  const graph = loadKcGraph();
  const problems = checkCourseBlueprint(blueprint, plans, new Set(graph.kcs.map(kc => kc.key)), graph.edges);
  if (problems.length) throw new Error(problems.map(problem => `${problem.code}: ${problem.message}`).join('; '));
  const ids = parseLessonIds(JSON.parse(readFileSync(paths.lessonIds, 'utf8')));
  if (Object.keys(ids).length !== plans.length) throw new Error('Release lesson IDs must cover exactly the reviewed source.');
  if (new Set(Object.values(ids)).size !== plans.length) throw new Error('Release lesson IDs must identify distinct Vault lessons.');
  const mapped = applyLessonIds(plans, ids);
  if (mapped.problems.length) throw new Error(mapped.problems.join('; '));
  const byId = new Map(plans.map(plan => [plan.lesson_id, plan]));
  const structure: CatalogStructure = {
    course_id: blueprint.course_id,
    pathways: [{ pathway_id: blueprint.pathway_id, age_band: blueprint.age_band,
      chapters: blueprint.units.map(unit => ({ chapter_id: unit.id, title: unit.title, objective: unit.objective,
        lessons: blueprint.lessons.filter(lesson => lesson.unit_id === unit.id).map(lesson => {
          const plan = byId.get(lesson.lesson_id)!;
          return { lesson_id: lesson.lesson_id, eligibility: plan.eligibility,
            knowledge_components: plan.knowledge_component_ids, new_concepts: plan.new_concepts,
            regional: 'universal' in plan.regional ? 'universal' as const : 'scenarios' as const,
            segment_types: [...new Set(plan.segments.map(segment => segment.type))] };
        }),
      })),
    }],
  };
  return { structure, plans: mapped.plans, ids, graph };
}
