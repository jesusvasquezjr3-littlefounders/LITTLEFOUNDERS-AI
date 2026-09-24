export type RuleLink = 'and' | 'or';
export type RuleCase = { saved: number; goal: number; goalDay: boolean };

/** Four cases expose both true/false combinations without author-supplied answers. */
export function savingsRuleCases(goal: number, shortfall: number): RuleCase[] | null {
  if (!Number.isSafeInteger(goal) || goal < 2 || goal > 100 || !Number.isSafeInteger(shortfall)
    || shortfall < 1 || shortfall >= goal) return null;
  return [
    { saved: goal - shortfall, goal, goalDay: false },
    { saved: goal, goal, goalDay: false },
    { saved: goal - shortfall, goal, goalDay: true },
    { saved: goal, goal, goalDay: true },
  ];
}

export function savingsRuleOutcome(value: RuleCase, link: RuleLink): boolean | null {
  if (!Number.isSafeInteger(value.saved) || value.saved < 0 || !Number.isSafeInteger(value.goal)
    || value.goal < 1 || value.goal > 100 || typeof value.goalDay !== 'boolean') return null;
  const met = value.saved >= value.goal;
  return link === 'and' ? met && value.goalDay : link === 'or' ? met || value.goalDay : null;
}
