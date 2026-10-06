import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { adoptedSources, adoptOpening, sequence } from './factory.mjs';
import { commitment } from './commitments.mjs';
import { capacity } from './capacity.mjs';
import { dates } from './dates.mjs';
import { borrowing } from './borrowing.mjs';
import { transfers } from './transfers.mjs';
import { uncertainIncome } from './uncertain-income.mjs';
import { reviewPayments } from './review-payments.mjs';
import { reviewChanges } from './review-changes.mjs';

const plans = [adoptOpening(0), adoptOpening(1), adoptOpening(2), commitment, capacity, dates, borrowing, transfers, uncertainIncome, reviewPayments, reviewChanges];
const expected = sequence.lessons.filter(lesson => lesson.domain === 'usable-money').map(lesson => lesson.lesson_id);
if (JSON.stringify(plans.map(plan => plan.lesson_id)) !== JSON.stringify(expected)) throw new Error('Opening batch differs from the declared production sequence.');
const root = new URL('../', import.meta.url);
const directory = new URL('course-plans/', root);
mkdirSync(directory, { recursive: true });
const hash = text => createHash('sha256').update(text).digest('hex');
const entries = plans.map(plan => {
  const text = `${JSON.stringify(plan, null, 2)}\n`;
  writeFileSync(new URL(`${plan.lesson_id}.json`, directory), text);
  return { lesson_id: plan.lesson_id, sha256: hash(text) };
});
writeFileSync(new URL('batch-manifest.json', root), `${JSON.stringify({
  version: 1, status: 'partial-production-draft', course_id: 'financial-education',
  planned_course_slots: sequence.lessons.length, authored_lessons: plans.length,
  whole_course_complete: false, publication_authorized: false,
  design_hash: hash(readFileSync(new URL('../../../curriculum-design/financial-education/lesson-sequence.json', import.meta.url), 'utf8')),
  calibration_adoption: adoptedSources.map(([lesson_id, sha256], index) => ({ source_lesson_id: lesson_id, source_sha256: sha256, draft_lesson_id: plans[index].lesson_id, changes: 'Explicit production identity and prerequisites; ledger success feedback describes the verified final balance. Approved source instruction retained; brief example numbers are alternatives.' })),
  newly_authored_lessons: plans.slice(3).map(plan => plan.lesson_id),
  lessons: entries,
  remaining: ['Remaining course teaching and integrated applications', 'Complete production blueprint and shared KC mapping', 'Localized player and interaction verification for these drafts', 'Regional findings and full release verification'],
  calls: { model: 0, image: 0, voice: 0, network: 0, publication: 0 },
}, null, 2)}\n`);
console.log(JSON.stringify({ authoredLessons: plans.length, reusedCalibratedSequences: 3, newlyAuthored: plans.length - 3, plannedCourseSlots: sequence.lessons.length, wholeCourseComplete: false, published: false }));
