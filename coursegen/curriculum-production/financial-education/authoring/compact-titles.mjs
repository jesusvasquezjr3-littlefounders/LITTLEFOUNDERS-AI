// Short navigation labels leave room for the scenario, choices and player controls.
// Objectives and explanations carry the full teaching scope; titles never abbreviate it.
const titles = {
  'financial-math': ['Units, cents','Checking change','Duplicate receipts','The shortfall','Equal groups','Equal contributions','Hundred parts','Percentage shares','The whole','Rate changes','Same period','Rounding steps','Reasonable estimates'],
  'financial-math-review': ['Trip estimates','Project estimates'],
  'goals-tradeoffs': ['Measurable goals','Real consequences','Opportunity cost','Setting priorities','Milestone amounts','Revising scope','Feasible actions','Updating goals'],
  'goals-tradeoffs-review': ['Repair plans','Shared goals'],
  'income-work': ['Recurring income','Net pay','Hourly pay','Work costs','Payment terms','Uneven income','Business withdrawals','Matching payments','Comparing work','Work rights'],
  'income-work-review': ['Shift decisions','Activity records'],
  'spending-patterns': ['Expense records','Spending patterns','Missing expenses','Repeated costs','Irregular expenses','Unused subscriptions','Feasible adjustments','Purchase pauses','Spending differences','Insufficient cuts'],
  'spending-patterns-review': ['Weekly records','Revising spending'],
  'cashflow-budget': ['Budget periods','Money purposes','Protected commitments','Period balance','Payment calendar','Persistent gaps','Irregular receipts','Future bills','Rebalancing plans','Percentage guidelines','Real deficits','Planned saving','Actual records','Carried bills'],
  'cashflow-budget-review': ['Between paydays','Closing budgets'],
  'accounts-records': ['Account features','Withdrawable money','Usage fees','Transaction details','Unmatched movements','Pending charges','Unfamiliar charges','Usable access','Protection claims','Private records'],
  'accounts-records-review': ['Account decisions','Verifying records'],
  'payments-digital': ['Payment funding','Transfer checks','Confirmed receipt','Payment routes','Private access','Payment pressure','Independent support','Exposed access','Recurring payments','Accurate reports'],
  'payments-digital-review': ['Tracing payments','Access protection'],
  'time-inflation': ['Simple interest','Growth sources','Compound interest','Growth comparisons','Added contributions','Basket prices','Income purchasing','Price indexes','Purchasing power','Projection assumptions'],
  'time-inflation-review': ['Growth records','Money purchasing'],
  'credit-mechanics': ['Loan parts','Loan payments','Remaining principal','Payment allocation','Loan balance','Payment duration','Affordable installments','Missed payments','Pledged assets','Variable rates','Comparable rates','Annual disclosures'],
  'credit-mechanics-review': ['Loan review','Borrowing decisions'],
  'debt-recovery': ['Debt inventory','Urgent consequences','Repayment order','Creditor discussions','Replacement plans','Consolidation costs','Relief claims','Seeking support'],
  'debt-recovery-review': ['Debt decisions','Recovery proposals'],
  'credit-records': ['Credit records','Account identity','Documented errors','Verified processes','Approval limits','Unknown accounts'],
  'credit-records-review': ['Account verification','Record protection'],
  'integrated-decisions': ['Income interruption','Reserve decisions','Care costs','Changing work','Urgent replacement','Goal funding','Debt priorities','New dependents','Compromised payment','Revised projections','Across borders','Action plans'],
};

export function compactEnglishTitle(lessonId) {
  const match = lessonId.replace('fe-production-', '').match(/^(.*)-(\d+)$/);
  return match ? titles[match[1]]?.[Number(match[2]) - 1] : undefined;
}
