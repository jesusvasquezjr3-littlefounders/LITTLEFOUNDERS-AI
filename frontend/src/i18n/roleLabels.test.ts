/**
 * THE `parent` ROLE'S LABEL MUST NOT COLLIDE WITH THE AI-TUTOR FEATURE'S OWN
 * LABEL, IN THE SAME LOCALE.
 *
 * `common.json`'s `roles.parent` is rendered verbatim by `RoleChip`
 * (`routes/admin/adminShared.tsx`) on `AdminRolesPage` and `AdminUsersPage` —
 * the admin console's role-distribution chart, filter chips, and per-user role
 * badges. GLOSSARY.md documents "Tutor" as the intended user-facing name for
 * that role in all three locales, matching what the product's own Terms &
 * Conditions ("Cuenta TUTOR" / "TUTOR Account" / "Conta TUTOR"), identity
 * verification flow ("Become a Tutor"), and dashboard upgrade CTA already call
 * it, in every locale.
 *
 * Round 92 found that reality disagreed with the glossary on two fronts:
 *   - es-MX correctly rendered "Tutor" for `roles.parent`, but the SAME
 *     locale's `admin.json` rendered the bare word "Tutor" for the unrelated
 *     AI-Tutor feature too (`analytics.usage.surfaces.tutor`,
 *     `insights.surfaces.tutor`) — a staff member scanning the admin
 *     role-distribution chart could not tell a human guardian account from
 *     the AI Tutor feature by the word "Tutor" alone.
 *   - pt-BR rendered "Responsável" for `roles.parent`, disagreeing with both
 *     es-MX and GLOSSARY.md, despite pt-BR's OWN auth flow, dashboard upgrade
 *     copy, and Terms & Conditions already calling the same role "Tutor".
 *   - en-US rendered "Parent" for `roles.parent`, also disagreeing with
 *     GLOSSARY.md and with its OWN auth/dashboard upgrade copy ("Become a
 *     Tutor").
 *
 * The fix keeps "Tutor" as the `parent` role's name in all three locales (no
 * new term invented — it is what the rest of each locale's own product
 * already calls this role) and instead qualifies the AI-feature admin labels
 * that had gone bare, matching the disambiguation `dashboard.json`'s
 * `nav.tutor` already used before this fix ("AI Tutor" / "Tutor IA").
 *
 * This file directly loads the locale JSON (the `check-i18n.sh` gate only
 * checks KEY parity, never VALUE content) so a future edit that reintroduces
 * either defect — a bare "Tutor" AI-feature label, or a `roles.parent` that
 * drifts from what the rest of that locale already calls the role — fails
 * here instead of shipping to the admin console unnoticed.
 */

import { describe, expect, it } from 'vitest';
import enCommon from './en-US/common.json';
import esCommon from './es-MX/common.json';
import ptCommon from './pt-BR/common.json';
import enAdmin from './en-US/admin.json';
import esAdmin from './es-MX/admin.json';
import ptAdmin from './pt-BR/admin.json';
import enDashboard from './en-US/dashboard.json';
import esDashboard from './es-MX/dashboard.json';
import ptDashboard from './pt-BR/dashboard.json';

type AdminBundle = { analytics: { usage: { surfaces: { tutor: string } } }; insights: { surfaces: { tutor: string } } };
type DashboardBundle = { nav: { tutor: string } };
type CommonBundle = { roles: { parent: string } };

const LOCALES: Record<string, { common: CommonBundle; admin: AdminBundle; dashboard: DashboardBundle }> = {
  'en-US': { common: enCommon, admin: enAdmin as unknown as AdminBundle, dashboard: enDashboard },
  'es-MX': { common: esCommon, admin: esAdmin as unknown as AdminBundle, dashboard: esDashboard },
  'pt-BR': { common: ptCommon, admin: ptAdmin as unknown as AdminBundle, dashboard: ptDashboard },
};

describe('the parent role label vs. the AI-Tutor feature label', () => {
  it.each(Object.keys(LOCALES))('%s: roles.parent does not equal the admin console adoption-table AI-Tutor surface label', (locale) => {
    const { common, admin } = LOCALES[locale]!;
    expect(common.roles.parent).not.toBe(admin.analytics.usage.surfaces.tutor);
  });

  it.each(Object.keys(LOCALES))('%s: roles.parent does not equal the admin console "Where time goes" AI-Tutor surface label', (locale) => {
    const { common, admin } = LOCALES[locale]!;
    expect(common.roles.parent).not.toBe(admin.insights.surfaces.tutor);
  });

  it.each(Object.keys(LOCALES))('%s: roles.parent does not equal the main app nav AI-Tutor label', (locale) => {
    const { common, dashboard } = LOCALES[locale]!;
    expect(common.roles.parent).not.toBe(dashboard.nav.tutor);
  });

  /*
   * Not a general i18n rule — locales are free to use different words for the
   * same role. This one holds only because Round 92 deliberately chose the
   * shared loanword "Tutor" for all three, since that is what each locale's
   * OWN Terms & Conditions, verification flow and dashboard upgrade copy
   * already called this role. A future locale addition is not obligated to
   * match this string, only to keep clear of ITS OWN AI-Tutor label (the
   * three checks above, which are the ones that generalize).
   */
  it('all three locales currently agree on the same word for roles.parent', () => {
    const values = Object.values(LOCALES).map((l) => l.common.roles.parent);
    expect(new Set(values).size).toBe(1);
  });
});
