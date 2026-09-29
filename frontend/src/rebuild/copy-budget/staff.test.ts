import { describe, it } from 'vitest';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/* `rebuild-staff.json` (Lane 6): the staff console (adult staff; the app budget for adults). */

describe('rebuild-staff copy budget', () => {
  for (const [locale, strings] of namespaceCopy('staff')) {
    it(`fits the adult app budget in ${locale}`, () => {
      expectBudgetedGroups(strings, ['staffConsole', 'staffLiveContent', 'staffMentorQuality']);
      // W2T.1: the rebuilt staff console. Keys are <screen>.<role>.<key>, so the role is read from the path;
      // placeholders are filled with the longest real value (the longest role, permission and date shape).
      const consoleCopy = strings.staffConsole as {
        roleNames: { option: Record<string, string> }; generation: { option: Record<string, string> };
        permissions: { option: Record<string, string> }; support: { option: Record<string, string> };
      };
      const longest = (values: string[]) => values.reduce((a, b) => (b.length > a.length ? b : a));
      const longestRole = longest(Object.values(consoleCopy.roleNames.option));
      // W2T.2: a judge dimension is the longest rubric label; money and shares take their longest real shape.
      // F1-staff-ops: a reviewed grant is the longest role or staff-access name; a job the longest job name.
      const longestGrant = longest([...Object.values(consoleCopy.roleNames.option), ...Object.values(consoleCopy.permissions.option)]);
      const longestJob = longest(Object.entries(consoleCopy.support.option).filter(([key]) => key.startsWith('job_')).map(([, value]) => value));
      const longestDimension = longest(Object.entries(consoleCopy.generation.option).filter(([key]) => key.startsWith('dim_')).map(([, value]) => value));
      // F4-staff-ops: the coach's localized proposals name a pipeline stage and a lowest judge score.
      const longestStage = longest(Object.entries(consoleCopy.generation.option).filter(([key]) => key.startsWith('stage_')).map(([, value]) => value));
      for (const [path, text] of flatten(strings.staffConsole!)) {
        const role = path.split('.')[1];
        expect(['action', 'heading', 'body', 'option'], `staffConsole.${path}`).toContain(role);
        const filled = text.replace(/\{role\}/g, longestRole).replace(/\{name\}/g, 'Ana').replace(/\{(?:date|from|to)\}/g, 'Sep 12, 2026')
          .replace(/\{(?:n|start|end|total|shown|open|visitors|accounts|bucket)\}/g, '12').replace(/\{id\}/g, '1a2b3c4d')
          .replace(/\{share\}/g, '50%').replace(/\{dimension\}/g, longestDimension).replace(/\{stage\}/g, longestStage).replace(/\{low\}/g, '4.25')
          .replace(/\{(?:cost|spent|latest|average)\}/g, '12,345.67 USD').replace(/\{(?:progress|target)\}/g, '100%')
          .replace(/\{(?:topics|lessons|published|failed|skipped|done|passed|inherited|billed)\}/g, '1,234').replace(/\{value\}/g, '4.25')
          // W2T.3: Analytics & Health and Learning intel. A place is the longest country name we list; a list of places, two of them;
          // a filter is a dimension and its value; a metric is the longest metric label; counts take their longest real shape.
          .replace(/\{(?:country|place)\}/g, 'United States').replace(/\{places\}/g, 'Kosovo, Western Sahara')
          .replace(/\{filter\}/g, 'Country: Mexico').replace(/\{metric\}/g, 'daily users')
          .replace(/\{(?:converted|events|sessions|accounts|learners|peak|latest)\}/g, '12,345').replace(/\{change\}/g, '+1,234')
          .replace(/\{grant\}/g, longestGrant).replace(/\{job\}/g, longestJob).replace(/\{(?:met|num|den)\}/g, '12,345')
          // G.2 (GAP-FIX-R2): the retroactive release-check window, in days.
          .replace(/\{days\}/g, '365');
        expect(filled, `staffConsole.${path} has an unfilled placeholder`).not.toMatch(/\{\w+\}/);
        expectFits(filled, role as 'action' | 'heading' | 'body' | 'option', locale, 'adult', `staffConsole.${path}`);
      }
      // C.5 / C.6: the staff live-content surfaces.
      for (const [path, text] of flatten(strings.staffLiveContent!)) {
        const role = ['title', 'reviewTitle', 'packsTitle'].includes(path) || path.startsWith('category.') ? 'heading'
          : ['approve', 'quality', 'safety', 'publish', 'archive'].includes(path) ? 'action' : 'body';
        const filled = text.replace('{n}', '12').replace('{rate}', '50%').replace('{floor}', '15%')
          .replace('{tier}', '3').replace('{locale}', 'es-MX').replace('{count}', '4');
        expectFits(filled, role, locale, 'adult', `staffLiveContent.${path}`);
      }
      // C.24: the staff Mentor-quality dashboard. Placeholders filled with the longest real value (the longest owner-role name).
      const quality = strings.staffMentorQuality as { ownerRole: Record<string, string> };
      for (const [path, text] of flatten(strings.staffMentorQuality!)) {
        const role = ['title', 'flagsTitle', 'signalsTitle', 'reviewTitle'].includes(path) || path.startsWith('category.') ? 'heading'
          : ['acknowledge', 'resolve', 'confirmResolve', 'cancel', 'signReview'].includes(path) ? 'action' : 'body';
        const filled = text.replace('{n}', '12').replace('{rate}', '50%').replace('{role}', quality.ownerRole.safety_trust_lead!);
        expectFits(filled, role, locale, 'adult', `staffMentorQuality.${path}`);
      }
    });
  }
});
