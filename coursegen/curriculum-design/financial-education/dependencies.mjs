/** Proposed instructional dependencies. These are not active shared KC edges. */
export const domains = {
  money: 'usable-money', math: 'financial-math', goals: 'goals-tradeoffs',
  income: 'income-work', spending: 'spending-patterns', budget: 'cashflow-budget',
  accounts: 'accounts-records', payments: 'payments-digital', purchase: 'purchase-decisions',
  saving: 'saving-resilience', time: 'time-inflation', credit: 'credit-mechanics',
  products: 'credit-products', recovery: 'debt-recovery', records: 'credit-records',
  insurance: 'insurance-risk', investing: 'investing-foundations', comparison: 'investment-comparison',
  tax: 'tax-public-systems', retirement: 'retirement-future', housing: 'housing-transport',
  shared: 'shared-finances', landscape: 'financial-landscape', integrated: 'integrated-decisions',
};

// Each pipe-delimited row belongs to the corresponding authored objective.
// Bare numbers refer to earlier objectives in that domain; alias.number crosses domains.
// '-' means no financial prerequisite: required reading/counting support belongs in the lesson.
export const requirements = {
  money: '0 | 0 1 | 1 | 1 2 3 | 1 3 4 | 1 2 3 | 2 | 1 4 5',
  math: 'money.2 | 1 | 1 money.7 | 2 money.4 | 3 | 5 | 6 | 5 7 | 6 8 | 7 8 | 5 6 | 1 6 | 2 5 6',
  goals: 'money.3 | money.3 | money.4 | 1 2 3 | 1 math.6 | 5 money.4 | 1 6 | 1 4 5',
  income: 'money.1 | math.2 | math.5 | 2 math.2 | money.5 | 1 math.3 math.6 | math.2 money.7 | 3 5 | 4 5 math.11 | 2 5',
  spending: 'money.2 | 1 goals.2 | 1 math.2 | 1 math.5 | 2 | 1 4 | 2 goals.2 goals.3 | goals.3 | 1 math.2 | 2 7 math.4',
  budget: 'income.1 spending.1 math.11 | 1 money.7 | 1 money.3 | 1 math.3 math.4 | 1 money.5 | 4 5 | 3 5 income.6 | 3 spending.5 math.6 | 3 4 | 3 math.8 spending.10 | 4 6 spending.7 | 2 3 goals.5 | 1 4 spending.9 | 5 13',
  accounts: 'money.3 | money.1 money.2 | math.3 math.5 | money.2 | 4 spending.1 math.2 | 2 4 | 4 5 | 1 | 1 | 4',
  payments: 'money.6 accounts.2 | accounts.4 | money.1 2 | 1 money.5 accounts.3 | 2 | 2 5 | 6 | 5 7 | accounts.4 spending.6 | 2 3 accounts.7',
  purchase: 'math.6 math.11 | math.3 | math.8 math.2 | 3 | 2 3 money.4 | 2 math.11 | 2 | spending.6 | 2 math.3 money.5 | 1 6 | 2 6 | 6 goals.3',
  saving: 'spending.5 budget.8 | budget.3 math.5 | 1 2 budget.11 | accounts.1 accounts.3 money.5 | goals.5 | 5 budget.9 | budget.5 5 | budget.3 goals.4 | 1 3 | 3 5 9',
  time: 'math.8 math.11 | 1 money.7 | 1 2 math.8 | 1 3 | 2 3 | math.8 purchase.1 | 6 math.8 | 6 spending.1 | 3 6 math.9 | 3 5',
  credit: 'money.6 purchase.2 | 1 math.3 | 1 math.8 math.11 | 3 math.2 | 4 | 2 5 | budget.5 2 | 1 money.5 | 1 | 3 7 | 3 time.3 | 1 2 11',
  products: 'accounts.4 credit.1 | 1 money.5 | 1 2 credit.3 | 1 credit.4 credit.5 | 1 credit.2 | credit.2 budget.5 | accounts.2 credit.1 | credit.2 credit.9 | credit.1 credit.8 | credit.2 credit.5',
  recovery: 'products.1 credit.2 credit.8 | 1 goals.2 | 1 2 credit.3 budget.11 | 1 budget.11 | credit.6 credit.7 | 5 | payments.6 payments.7 | 2 4 spending.10',
  records: 'credit.1 accounts.4 | 1 accounts.5 | 2 accounts.7 | 3 payments.7 | 1 credit.7 | 2 payments.8',
  insurance: 'saving.2 goals.2 | 1 saving.3 | 2 | 3 | 4 math.2 | 3 | 4 5 6 purchase.6 | 3 money.5 | 3 6 accounts.10 | 3 6 7 | 1 2 goals.8 | 3 time.10',
  investing: 'saving.4 money.5 | 1 goals.1 | 2 saving.2 | time.2 time.6 | 4 money.6 | 5 credit.8 | 5 time.1 | 3 5 | 8 | 5 8 | 1 saving.4 | accounts.9 time.10 | credit.1 3 4 | 3 4 time.10',
  comparison: 'investing.4 math.2 | time.5 math.11 | investing.3 time.10 | investing.10 investing.8 | investing.10 | investing.4 math.5 | purchase.11 | investing.9 math.8 | 1 purchase.11 | payments.7 investing.12',
  tax: 'income.2 purchase.2 | 1 income.2 | 1 math.8 math.3 | 3 math.2 | accounts.10 income.7 | 1 payments.7 | income.10 budget.1 | 5 6',
  retirement: 'goals.1 saving.5 | 1 tax.7 | 2 income.5 | time.3 time.5 | 4 comparison.1 | time.6 saving.2 | saving.4 2 | investing.4 time.10 | budget.9 saving.7 | insurance.3 accounts.10',
  housing: 'purchase.2 budget.1 | 1 purchase.6 | purchase.8 accounts.10 | 1 credit.2 purchase.6 | 4 credit.7 | 4 credit.10 budget.9 | 2 4 investing.3 | purchase.6 insurance.7 | credit.2 credit.7 | 8 9 purchase.8 | 4 8 spending.5 | 2 8 goals.3',
  shared: 'math.6 math.8 budget.3 | accounts.1 products.9 | 1 money.5 | payments.5 goals.7 | income.4 budget.9 | money.6 saving.8 | 2 3 accounts.10 | insurance.3 retirement.10 accounts.10',
  landscape: 'payments.7 accounts.9 | 1 investing.12 | 1 2 accounts.9 | accounts.7 purchase.8 | 4 1 | math.5 math.2 | 6 payments.4 | 6 math.8 | purchase.11 comparison.3 | payments.5 accounts.10',
  integrated: 'budget.9 budget.11 income.6 | saving.4 credit.2 credit.7 | budget.3 spending.10 shared.5 | income.9 housing.1 tax.7 | purchase.12 credit.7 purchase.11 | accounts.5 accounts.6 money.7 | recovery.3 investing.3 saving.4 | insurance.11 budget.9 shared.5 | payments.8 payments.10 budget.5 | retirement.6 retirement.9 time.10 | landscape.7 money.5 budget.6 | goals.7 recovery.8 tax.6 shared.8',
};
