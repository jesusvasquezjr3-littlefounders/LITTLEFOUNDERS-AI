# Future finance source notes

Checked on 2026-10-05. The scenarios are original fictional examples. These sources support general concepts, not a claim that a specific product is suitable, a local legal rule applies, or an outcome is guaranteed.

- [Investor.gov: Introduction to Investing](https://www.investor.gov/introduction-investing): separates income payments and asset-value changes.
- [Investor.gov: Asset Allocation and Diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation): time horizon, risk tolerance and spreading exposures.
- [Investor.gov: Bonds FAQ](https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products/bonds): borrower, interest-rate and liquidity risks.
- [SEC: Understanding Margin Accounts](https://www.sec.gov/investor/alerts/ib_marginaccounts.pdf): borrowed investment exposure can produce losses beyond the investor's initial cash. The lessons do not teach jurisdiction-specific margin rules.
- [Investor.gov: Index Funds](https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-4): tracking objectives, fees and tracking differences.
- [Investor.gov: International Investing](https://www.investor.gov/introduction-investing/investing-basics/investment-products/international-investing): exchange-rate movements can change results measured in the spending currency.
- [SEC: Conflicts of Interest Staff Bulletin](https://www.sec.gov/about/divisions-offices/division-trading-markets/broker-dealers/staff-bulletin-standards-conduct-broker-dealers-investment-advisers-conflicts-interest): compensation can create incentives that differ from an investor's objective. No US regulatory duties are transplanted into other markets.
- [IRS: Credits and Deductions](https://www.irs.gov/credits-and-deductions): different calculation roles of deductions and credits. All lesson rates, brackets and credit rules are explicitly fictional, not a substitute for local eligibility rules.
- [IRS: Tax Withholding Estimator](https://www.irs.gov/individuals/tax-withholding-estimator): withholding and final tax are separate quantities.
- [SAT: Declaración Anual](https://www.sat.gob.mx/minisitio/DeclaracionAnual/Personas/index.html), [SAT: Deducciones personales](https://www.sat.gob.mx/minisitio/DeduccionesPersonales/), and [Receita Federal: Imposto de Renda](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/imposto-de-renda/dirpf): official local starting points for country, period and case-specific questions. The lessons name the corresponding federal authority in each locale but do not assert actual deadlines, rates or eligibility thresholds.

## Scope and evidence

Additional primary sources checked on 2026-10-05:

- [CFPB mortgage costs](https://www.consumerfinance.gov/ask-cfpb/what-costs-come-with-taking-out-a-mortgage-en-153/) and [housing affordability](https://www.consumerfinance.gov/owning-a-home/prepare/figure-out-how-much-you-want-to-spend/): distinguish purchase, financing, upfront and ongoing costs. No national percentage rule or real rate is imported into the fictional scenarios.
- [CFPB auto-loan comparisons](https://www.consumerfinance.gov/ask-cfpb/how-do-i-compare-auto-loan-offers-what-should-i-look-at-besides-the-monthly-payment-en-753/) and [leasing versus buying](https://www.consumerfinance.gov/ask-cfpb/what-should-i-know-about-leasing-versus-buying-a-car-en-815/): total cost, use conditions and end ownership differ. Rental and vehicle clauses in these lessons are explicitly fictional.
- [CFPB help with banking](https://www.consumerfinance.gov/ask-cfpb/i-would-like-to-be-able-to-have-my-friend-or-family-member-help-with-my-bill-paying-and-banking-what-are-my-options-en-1145/), [managing someone else's money](https://www.consumerfinance.gov/consumer-tools/managing-someone-elses-money/), and [planning for diminished capacity](https://www.consumerfinance.gov/consumer-tools/educator-tools/resources-for-older-adults/financial-security-as-you-age/planning-for-diminished-capacity-and-illness/): access, ownership, beneficiary status and authority must not be collapsed into one concept. The lessons direct jurisdiction-dependent questions to qualified local advice rather than generalizing US legal rules.
- [CFPB family lending](https://www.consumerfinance.gov/consumer-tools/educator-tools/adult-financial-education/tips-for-managing-family-lending-and-borrowing/) and [UK government economic abuse toolkit](https://www.gov.uk/government/publications/public-sector-toolkits/economic-abuse-toolkit-v2-html): clarify expectations and preserve personal safety. Safety scenarios do not require confrontation or unsafe use of a monitored device.
- [CONDUSEF provider verification](https://www.condusef.gob.mx/?idc=2732&idcat=3&p=contenido), [Banco Central complaint guidance](https://www.bcb.gov.br/meubc/faqs/p/reclamarcontrabancoseoutrasinstituicoes), and [FDIC noninsured products](https://www.fdic.gov/resources/deposit-insurance/financial-products-not-insured): verify genuine provider, permitted scope and actual coverage; registration does not cover every product or loss. Lessons use fictional protection limits and require local official verification, without claiming a universal agency remit or deadline.
- [CFPB remittance explanations](https://www.consumerfinance.gov/ask-cfpb/what-is-a-remittance-transfer-and-what-are-my-rights-en-1161/): separate exchange rate, fees and recipient amount. All arithmetic examples explicitly state fee order, rate direction and any additional deductions; none represents a live quote.
- [SEC ESG investor bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-1): investigate criteria and evidence instead of treating a label as proof of impact or financial safety.
- [CFPB financial data sharing](https://www.consumerfinance.gov/archive/blog/what-to-consider-when-sharing-your-financial-data/) and [Banco Central consent cancellation](https://www.bcb.gov.br/meubc/faqs/p/como-cancelar-uma-autorizacao-no-open-finance): understand recipients, purpose and withdrawal; uninstalling software is not evidence of revoked consent. Lessons distinguish future access from previously shared records and assert no universal deletion rule.

Additional domains completed on 2026-10-06:

- [FTC warranties](https://consumer.ftc.gov/articles/warranties) and [complaints and returns](https://consumer.ftc.gov/articles/solving-problems-business-returns-refunds-and-other-resolutions): distinguish defect coverage, return conditions and separately purchased protection. All graded contractual conditions are explicitly fictional; statutory consumer rights are not generalized across markets. Purchase calculations are original, code-recalculable scenarios with explicit units, mandatory charges, discount order and ownership period.
- [CFPB emergency fund guide](https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/): savings purpose, individual capacity, cash-flow timing, access and replenishment. No universal reserve amount, contribution share or product recommendation is asserted. Exercises use actual scenario constraints, distinguish planned irregular bills from unforeseen disruptions, and avoid shame after a missed contribution.

`index.mjs` exports `buildPlans(resolveSkill)`, `proposedSkills`, and `authoredLessonIds`. The resolver accepts sequence lesson IDs and returns shared KC keys with or without the `finance.` prefix. These are draft nodes requiring reconciliation with the shared graph; the author does not edit shared seeds.

The compact source helper only assembles literal trilingual storyboards. It does not invent localized copy or expand numeric templates. Independent numeric answer choices carry recalculated arithmetic proofs. The worked-example board is used only for guided calculation because its replay can reveal results.

Run `node coursegen/curriculum-production/financial-education/authoring/future-finance/check.mjs` to emit this author's draft plans and check local invariants. Its compact copy check is not actual-player evidence. The coordinator owns final graph integration, player coverage, regional review, and release.

## Insurance and risk extension — 2026-10-06

- [NAIC insurance mechanics](https://content.naic.org/consumer/how-does-insurance-work): premium, deductible, contractual coverage and retained costs.
- [NAIC insurance terms](https://content.naic.org/glossary-insurance-terms): policy roles, exclusions and coverage conditions.
- [NAIC homeowners consumer guide](https://content.naic.org/consumer/homeowners-insurance.htm): compare equivalent coverage and preserve loss records; no jurisdiction-specific exclusion is asserted as universal.
- [NAIC life insurance illustrations](https://content.naic.org/insurance-topics/life-insurance-illustrations): distinguish contractual benefits from values dependent on future assumptions.

All deadlines, waits, losses, caps and contract examples are explicitly fictional. Claim calculations floor post-deductible payment at zero and then apply the stated insurer payout cap; this is an authored contract rule, not a universal insurance formula. Overlap is assessed through the supplied payment coordination terms.

## Credit products extension — 2026-10-06

- [CFPB credit card grace periods](https://www.consumerfinance.gov/ask-cfpb/what-is-a-grace-period-for-a-credit-card-en-47/): distinguish eligible purchase rules, full payment, timing and cash advances. No US statutory deadline is imported into other locales.
- [FTC credit card use](https://consumer.ftc.gov/articles/using-credit-cards-and-disputing-charges): minimum payments and borrowing cost. Every interest amount in the lessons is supplied by an explicitly fictional schedule, not inferred from an advertised annual rate.
- [CFPB overdraft options](https://www.consumerfinance.gov/consumer-tools/bank-accounts/know-your-overdraft-options/): own account funds versus overdraft borrowing and its terms.
- [MoneyHelper guarantor loans](https://www.moneyhelper.org.uk/en/everyday-money/credit/guarantor-loans-explained): a guarantee can create payment duties. The examples give their own scope, trigger and release conditions rather than asserting a universal local legal rule.
- [FTC short-term loan renewals](https://consumer.gov/debt/payday-loans-and-cash-advances-explained): extension fees can add cost without repaying principal.

The visible Rho correction in credit-products-04 explicitly states fictional full-payment conditions before correcting the minimum-payment misconception. All card dates, schedules, costs, collateral and guarantee consequences are authored fictional terms. The instalment timeline uses four real calendar dates and independently grades the first due plan; subsequent practice combines overlapping payments and retains each due date.
