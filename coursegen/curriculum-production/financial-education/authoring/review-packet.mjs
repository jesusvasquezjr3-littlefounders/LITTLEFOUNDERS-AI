import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../../', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name,root),'utf8'));
const report = read('coursegen/runs/production-complete/report.json');
if (!report.ok || report.authoredLessons !== 294 || report.emittedDocuments !== 882) throw Error('A complete valid candidate is required.');
const blueprint = read('coursegen/curriculum-production/financial-education/complete-source/blueprint.json');
const docs = read('coursegen/runs/production-complete/documents.json');
const checks = ['working_memory','feedback_scope','reward_autonomy','practice_zone','age_register',
  'resolution_efficiency','register_genuine','autonomy_real','reasoning_authentic','mentor_fallibility'];
const marketChecks = ['market_problem','everyday_context','plausible_amounts','currency','no_foreign_context',
  'concept_answer_difficulty','copy_tone_no_shame','market_specific_finding'];
const pending = names => Object.fromEntries(names.map(name => [name,{result:null,finding:''}]));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const packet = {
  schema_version:1, status:'pending-human-review', course:'financial-education', input_hash:report.inputHash,
  scope:'294 adult introductory lessons. This is an unsigned review worksheet, not a publication attestation or a database content fingerprint.',
  instructions:'Review the exact lesson in each market. Record findings and resolve every flagged item. No pass is preselected. A reviewer must identify themselves; an approval without findings does not satisfy Stage 3. After import, bind actual findings to the current database fingerprint through the existing staff review workflow.',
  reviewer:null, author:'AI-assisted course authoring', approved_at:null,
  references:['docs/content/REGIONAL-ADAPTATION-GATE.md','database/migrations/0249_lesson_pedagogical_reviews.sql'],
  lessons:blueprint.lessons.map(lesson => {
    const plan = read(`coursegen/curriculum-production/financial-education/complete-source/plans/${lesson.lesson_id}.json`);
    const localized = docs.filter(row => row.lesson_id === lesson.lesson_id);
    if (localized.length !== 3) throw Error(`Missing localized documents: ${lesson.lesson_id}`);
    return {lesson_id:lesson.lesson_id,title:plan.title,kind:lesson.kind,objective:plan.instruction.objective,
      status:'pending',checks:pending(checks),
      markets:Object.fromEntries(localized.map(row => [row.locale,{document_sha256:hash(row.document),
        preview:`http://127.0.0.1:5199/scripts/course-review/index.html?locale=${row.locale}&lesson=${row.lesson_id}`,
        checks:pending(marketChecks)}])),
      flagged_items:report.review.filter(item => item.lessonId === lesson.lesson_id).map(item => ({...item,resolution:null,finding:''}))};
  }),
};
const destination = new URL('audit-results/financial-course/production-human-review.json',root);
mkdirSync(new URL('.',destination),{recursive:true});
writeFileSync(destination,JSON.stringify(packet,null,2)+'\n');
console.log(JSON.stringify({file:fileURLToPath(destination),lessons:packet.lessons.length,flaggedItems:report.review.length,status:packet.status}));
