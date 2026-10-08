import { interruptedIncome } from './interrupted-income.mjs';
import { reserveOrLoan } from './reserve-or-loan.mjs';
import { caregivingShortfall } from './caregiving-shortfall.mjs';
import { jobMove } from './job-move.mjs';
import { urgentPurchase } from './urgent-purchase.mjs';
import { accountReconciliation } from './account-reconciliation.mjs';
import { debtOrInvestment } from './debt-or-investment.mjs';
import { newDependent } from './new-dependent.mjs';
import { compromisedPayment } from './compromised-payment.mjs';
import { retirementRevision } from './retirement-revision.mjs';
import { crossBorderPayment } from './cross-border-payment.mjs';
import { verifiedActionPlan } from './verified-action-plan.mjs';
export const buildPlans = resolveSkill => [interruptedIncome, reserveOrLoan, caregivingShortfall, jobMove, urgentPurchase,
  accountReconciliation, debtOrInvestment, newDependent, compromisedPayment, retirementRevision, crossBorderPayment,
  verifiedActionPlan].map(build => build(resolveSkill));
export const proposedSkills = [];
export const authoredLessonIds = Array.from({ length: 12 }, (_, index) => `fe-production-integrated-decisions-${String(index + 1).padStart(2, '0')}`);
