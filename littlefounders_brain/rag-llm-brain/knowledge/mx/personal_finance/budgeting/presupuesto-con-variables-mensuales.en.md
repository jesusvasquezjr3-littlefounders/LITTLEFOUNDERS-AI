---
doc_id: "mx-personal_finance-budgeting-presupuesto-con-variables-mensuales"
title_es: "Presupuesto con variables mensuales: servicios, alimentación y transporte"
title_en: "Monthly variable budgeting: utilities, food, and transportation"
language: "en"
translation_of: "mx-personal_finance-budgeting-presupuesto-con-variables-mensuales"
country: "mx"
jurisdiction: "MX-FED"
domain: "personal_finance"
subdomain: "budgeting"
concept_ids: [budgeting, monthly_expenses, income_tracking, cost_control]
age_bands: [tier4, tier5]
depth_tier: "intermediate"
volatility: "low"
last_verified_date: "2026-06-20"
verified_by: "qwen-pipeline"
review_due: "2028-06-20"
sources: [src_gen_b306d4d2, src_lisr]
status: "review"
currency: "MXN"
schema_version: "kb-1.0"
---
## For future Claude
This document explains how to build a realistic monthly budget for older teens and young adults in Mexico (ages 15–25+), using only official data current as of 2026-06-20. It focuses on expenses that change each month —such as electricity, water, public transport, or food—and avoids prohibited abstract terms (e.g., 'investment', 'debt'). It differs clearly from U.S. models: it does not apply the IRS or FLSA; instead, it uses Mexico’s 2026 federal minimum wage and the Income Tax Law (LISR) effective since April 1, 2024.

## For older teens and young adults (tier4–tier5) <!-- age_band: tier4,tier5 -->
Your actual monthly spending depends on three things: how much you earn, where you live, and what you need each month. In Mexico, the official daily minimum wage differs by zone: $248.93 nationwide and $312.41 in the Northern Border Free Zone <!-- @fact id=sm.2026.general value=248.93 verified=2026-06-20 src=src_gen_b306d4d2 volatility=low -->, <!-- @fact id=sm.2026.zona_norte value=312.41 verified=2026-06-20 src=src_gen_b306d4d2 volatility=low -->. That means if you work 22 days per month, your base monthly income ranges between $5,476 and $6,873 — though many jobs pay more, and some less.

To build your budget, record each month:
- What you receive (salary, family support, informal income);
- What you pay for fixed services (water, internet, basic health insurance);
- What you spend on variable items: electricity (higher in summer), transport (more trips = more fares), and food (more meals outside = higher cost).

For example, if you earn $5,000 per month and live alone in Mexico City, you might allocate:
• $1,200 for electricity, water, and gas;
• $600 for transport (Metro + bus + occasional Uber);
• $1,800 for food (grocery market + 6 meals out weekly);
• $700 for phone, subscriptions, and "extras" (gym, streaming);
• $700 for savings or emergencies.

That totals $5,000. If you have surplus or shortfall, adjust only the variable categories—not the fixed ones—because those are the ones you can control without compromising basic needs.

Remember: if you work formally, your employer already withholds taxes under the Income Tax Law (LISR), which applies to all income earned by individuals residing in Mexico <!-- @fact id=l_isr.art1.i value=Artículo 1, fracción I verified=2026-06-20 src=src_lisr volatility=low --> and has been in force since April 1, 2024 <!-- @fact id=l_isr.effective_date value=2024-04-01 verified=2026-06-20 src=src_lisr volatility=low -->. But you do not file or pay income tax directly if your annual income falls below the taxable threshold—the calculation is handled automatically by your employer.

You don’t need an app or course: a simple Excel sheet with three columns (month, income, expense) and a 30-day review is enough. The goal isn’t to save everything—it’s to know exactly where every peso goes.
