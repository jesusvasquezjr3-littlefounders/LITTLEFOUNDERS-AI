import { creditProducts, attachCreditRecovery } from './credit-products.mjs';
import { creditReviews } from './credit-reviews.mjs';
import { insuranceRisk } from './insurance-risk.mjs';
import { insuranceReviews } from './insurance-reviews.mjs';
import { investingFoundations } from './investing-foundations.mjs';
import { investingReviews } from './investing-reviews.mjs';
import { localizedObjectives } from './objectives.mjs';
import { investmentComparison } from './investment-comparison.mjs';
import { comparisonReviews } from './comparison-reviews.mjs';
import { taxPublicSystems } from './tax-public-systems.mjs';
import { taxReviews } from './tax-reviews.mjs';
import { retirementFuture } from './retirement-future.mjs';
import { retirementReviews } from './retirement-reviews.mjs';
import { housingTransport } from './housing-transport.mjs';
import { housingReviews } from './housing-reviews.mjs';
import { sharedFinances } from './shared-finances.mjs';
import { sharedReviews } from './shared-reviews.mjs';
import { financialLandscape } from './financial-landscape.mjs';
import { landscapeReviews } from './landscape-reviews.mjs';
import { purchaseDecisions } from './purchase-decisions.mjs';
import { purchaseReviews } from './purchase-reviews.mjs';
import { savingResilience } from './saving-resilience.mjs';
import { savingReviews } from './saving-reviews.mjs';
import { assemble, sequence, proposedSkill } from './helpers.mjs';

export const storyboards = [...investingFoundations, ...investingReviews, ...investmentComparison, ...comparisonReviews, ...taxPublicSystems, ...taxReviews, ...retirementFuture, ...retirementReviews, ...housingTransport, ...housingReviews, ...sharedFinances, ...sharedReviews, ...financialLandscape, ...landscapeReviews, ...purchaseDecisions, ...purchaseReviews, ...savingResilience, ...savingReviews, ...insuranceRisk, ...insuranceReviews, ...creditProducts, ...creditReviews];
export const authoredLessonIds = storyboards.map(row => row.id);
export const proposedSkills = storyboards.filter(row => !row.primary).map(row => ({
  lesson_id: row.id,
  key: `finance.${proposedSkill(row.id)}`,
  title: Object.fromEntries(['en-US', 'es-MX', 'pt-BR'].map((locale, i) => [locale, row.title.split('|')[i]])),
  objective: {
    'en-US': sequence.find(lesson => lesson.lesson_id === row.id).objective,
    'es-MX': localizedObjectives[row.id.replace('fe-production-', '')][0],
    'pt-BR': localizedObjectives[row.id.replace('fe-production-', '')][1],
  },
  prerequisite_lesson_ids: sequence.find(lesson => lesson.lesson_id === row.id).prerequisites,
  status: 'draft',
}));
export const buildPlans = resolveSkill => {
  const plans = assemble(storyboards, resolveSkill);
  attachCreditRecovery(plans);
  return plans;
};
