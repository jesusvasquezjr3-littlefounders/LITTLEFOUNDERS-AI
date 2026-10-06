import { assemble, sequence } from './helpers.mjs';
import { timeInterest } from './time-interest.mjs';
import { timeSources } from './time-sources.mjs';
import { timeCompound } from './time-compound.mjs';
import { timeCompare } from './time-compare.mjs';
import { creditRecords } from './credit-records.mjs';
import { creditRecordReviews } from './credit-records-reviews.mjs';
import { creditCalculations } from './credit-calculations.mjs';
import { creditTerms } from './credit-terms.mjs';
import { objectiveTranslations } from './objective-translations.mjs';
import { creditComparison } from './credit-comparison.mjs';
import { creditRateComparison } from './credit-rate-comparison.mjs';
import { creditReviews } from './credit-reviews.mjs';

import { timeContributions } from './time-contributions.mjs';
import { timeBasket } from './time-basket.mjs';
import { timeIncome } from './time-income.mjs';
import { timeIndex } from './time-index.mjs';
import { timePurchasing } from './time-purchasing.mjs';
import { timeModel } from './time-model.mjs';
import { timeReviews } from './time-reviews.mjs';
import { debtInventory } from './debt-inventory.mjs';
import { debtConsequences } from './debt-consequences.mjs';
import { debtOrder } from './debt-order.mjs';
import { debtPrepare } from './debt-prepare.mjs';
import { debtRestructure } from './debt-restructure.mjs';
import { debtConsolidate } from './debt-consolidate.mjs';
import { debtClaims } from './debt-claims.mjs';
import { debtSupport } from './debt-support.mjs';
import { debtReviews } from './debt-reviews.mjs';
export const records = [...creditRecords, ...creditRecordReviews, ...creditCalculations, ...creditTerms, ...creditComparison, ...creditRateComparison, ...creditReviews, ...timeInterest, ...timeSources, ...timeCompound, ...timeCompare, ...timeContributions, ...timeBasket, ...timeIncome, ...timeIndex, ...timePurchasing, ...timeModel, ...timeReviews, ...debtInventory, ...debtConsequences, ...debtOrder, ...debtPrepare, ...debtRestructure, ...debtConsolidate, ...debtClaims, ...debtSupport, ...debtReviews];
export const authoredLessonIds = records.map(record => record.id);
export const proposedSkills = records.filter(record => !record.primary).map(record => ({
  lesson_id: record.id,
  skill_id: `prod.${record.id.replace('fe-production-', '').replace(/-(\d+)$/, '.$1')}`,
  objective: sequence.find(lesson => lesson.lesson_id === record.id).objective,
  objective_i18n: {
    'en-US': sequence.find(lesson => lesson.lesson_id === record.id).objective,
    'es-MX': objectiveTranslations[record.id.replace('fe-production-', '')]?.[0],
    'pt-BR': objectiveTranslations[record.id.replace('fe-production-', '')]?.[1],
  },
  prerequisite_lesson_ids: sequence.find(lesson => lesson.lesson_id === record.id).prerequisites,
}));
export const lessonKcMapping = Object.fromEntries(proposedSkills.map(record => [record.lesson_id, record.skill_id]));
export function buildPlans(resolveKc) { return records.map(record => assemble(record, resolveKc)); }
