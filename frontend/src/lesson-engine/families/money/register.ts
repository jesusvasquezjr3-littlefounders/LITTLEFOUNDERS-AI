// `money` family registry slice — composed by lesson-engine/registry.ts.

import type { Registry } from '../../core/types'
import {
  BudgetFit,
  CoinCount,
  FairTrade,
  InterestPeek,
  MakeChange,
  NeedsWants,
  PiggySplit,
  PriceCompare,
  SavingsGoal,
  buildNeedsWantsAnswer,
  buildSavingsGoalAnswer,
  moneyCanSubmit,
} from './components'

export { moneySchemas } from './schema'
export { moneyGraders } from './grade'
export { moneyFixtures } from './fixtures'

export const moneyRegistry: Registry = {
  coin_count: { kind: 'input', component: CoinCount, canSubmit: moneyCanSubmit.coin_count },
  make_change: { kind: 'input', component: MakeChange, canSubmit: moneyCanSubmit.make_change },
  piggy_split: { kind: 'input', component: PiggySplit, canSubmit: moneyCanSubmit.piggy_split },
  needs_wants: {
    kind: 'input',
    component: NeedsWants,
    canSubmit: moneyCanSubmit.needs_wants,
    buildAnswer: buildNeedsWantsAnswer,
  },
  price_compare: {
    kind: 'input',
    component: PriceCompare,
    canSubmit: moneyCanSubmit.price_compare,
  },
  budget_fit: { kind: 'input', component: BudgetFit, canSubmit: moneyCanSubmit.budget_fit },
  savings_goal: {
    kind: 'input',
    component: SavingsGoal,
    canSubmit: moneyCanSubmit.savings_goal,
    buildAnswer: buildSavingsGoalAnswer,
  },
  fair_trade: { kind: 'input', component: FairTrade, canSubmit: moneyCanSubmit.fair_trade },
  interest_peek: { kind: 'flow', component: InterestPeek },
}
