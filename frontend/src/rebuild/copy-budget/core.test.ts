import { describe, it } from 'vitest';
import type { CopyRole } from '../design/copyBudget';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/*
 * `rebuild-core.json` (Lane 0): the preview index, the S03.1 control catalogue,
 * the S03.2 overlay and shell gallery. Everything is measured at the youngest
 * (6–9) budget except the gallery's public-site pair; the W2 shells on real
 * routes (appShell, siteShell) and the not-found state are budgeted by who
 * reads them.
 */

/** W2 app shells: the learner's navigation at the youngest budget, the staff console's at the adult one. */
function appShellRole(path: string): CopyRole {
  return ['navigation', 'tutorRole', 'staffRole', 'loading'].includes(path) ? 'body' : 'action';
}
/** W2 public site and sign-in shells (adult readers, the app budget: the stricter of the two). */
function siteShellRole(path: string): CopyRole {
  if (path.startsWith('pageTitle.')) return 'heading';
  if (['legal', 'language', 'theme', 'rights'].includes(path)) return 'body';
  if (path.startsWith('theme')) return 'option';
  return 'action';
}

const flat: Record<string, CopyRole> = {
  preview: 'body', heading: 'heading', intro: 'body', practice: 'action', controls: 'action',
  lessonDemo: 'action', timelineDemo: 'action', numberLineDemo: 'action', age: 'body', adult: 'option',
  question: 'prompt', save: 'option', spend: 'option', check: 'action', again: 'action',
  correct: 'body', hint: 'body', name: 'body', nameHint: 'body',
  confirm: 'action', confirmed: 'body', required: 'body', theme: 'body', light: 'option',
  dark: 'option', language: 'body',
};

/** Roles of the S03.1 control catalogue strings. */
function designSystemRole(key: string): CopyRole {
  if (['title', 'buttons', 'fields', 'choices', 'status', 'cards', 'feedback', 'mentor', 'cardTitle', 'courseTitle', 'empty', 'failed'].includes(key)) return 'heading';
  if (['continue', 'saveCoins', 'share', 'help', 'approve', 'remove', 'cancel', 'claim', 'open', 'details', 'saving', 'close', 'menu',
    'show', 'hide', 'less', 'more', 'retryAction', 'retrying'].includes(key)) return 'action';
  if (['pocketSave', 'pocketSpend', 'pocketShare', 'daily', 'weekly', 'on', 'off', 'chart', 'table'].includes(key)) return 'option';
  if (['coinsValue', 'progressValue', 'mentorName'].includes(key)) return 'data';
  return 'body';
}

/** Roles of the S03.2 overlay and shell gallery strings. */
const designGalleryRoles: Record<string, CopyRole> = {
  ...Object.fromEntries(['title', 'dialogs', 'confirmHeading', 'panels', 'sheetHeading', 'tips', 'messages', 'moreGoals', 'siteHeading', 'singleHeading', 'tableCaption'].map((key) => [key, 'heading'])),
  ...Object.fromEntries(['controls', 'overlays', 'shellLearner', 'shellTeen', 'shellTutor', 'shellStaff', 'shellStaffLimited', 'shellSite', 'shellAuth', 'shellSingle', 'shellTable', 'allComponents', 'openGoal', 'done', 'removeGoal', 'keepGoal', 'removing', 'why', 'moreActions', 'editGoal', 'pauseGoal', 'shareGoal', 'archiveGoal', 'aboutCoins', 'saveGoal', 'showError', 'undo', 'dismiss', 'skip', 'learn', 'tasks', 'wallet', 'profile', 'mentorWord', 'family', 'progress', 'settings', 'overview', 'users', 'content', 'insights', 'reports', 'audit', 'emails', 'howItWorks', 'forFamilies', 'login', 'startFree', 'privacy', 'terms', 'goBack'].map((key) => [key, 'action'])),
  ...Object.fromEntries(['indexBody', 'goalBody', 'confirmBody', 'removed', 'sheetBody', 'whyBody', 'menuDone', 'tipBody', 'saved', 'goalBike', 'goalBook', 'goalGift', 'goalGame', 'goalLeft', 'navigation', 'pageBody', 'tutorRole', 'staffRole', 'siteBody', 'identifier', 'singleBody', 'colName', 'colRole', 'colStatus', 'roleLearner', 'statusActive', 'statusInvited'].map((key) => [key, 'body'])),
};

describe('rebuild-core copy budget', () => {
  for (const [locale, strings] of namespaceCopy('core')) {
    it(`fits the youngest copy budget in ${locale}`, () => {
      expectBudgetedGroups(strings, [...Object.keys(flat), 'dateParts', 'designSystem', 'designGallery', 'appShell', 'siteShell', 'notFound', 'sessionPreferences']);
      const dates = strings.dateParts as Record<string, string>;
      expectBudgetedGroups(dates, ['day', 'month', 'year', 'invalid', 'min', 'max']);
      for (const [key, text] of Object.entries(dates)) {
        expectFits(text.replace('{date}', '2026-09-24'), 'body', locale, '6-9', `dateParts.${key}`);
      }
      for (const [key, role] of Object.entries(flat)) expectFits(strings[key] as string, role, locale, '6-9', key);
      for (const [key, text] of Object.entries(strings.designSystem as Record<string, string>)) {
        expectFits(text.replace('{n}', '40'), designSystemRole(key), locale, '6-9', `designSystem.${key}`);
      }
      const gallery = strings.designGallery as Record<string, string>;
      expectBudgetedGroups(gallery, Object.keys(designGalleryRoles));
      for (const [key, text] of Object.entries(gallery)) {
        const site = key === 'siteHeading' || key === 'siteBody';
        expectFits(text, designGalleryRoles[key] ?? 'body', locale, site ? 'adult' : '6-9', `designGallery.${key}`, site ? 'site' : 'app');
      }
      for (const [path, text] of flatten(strings.appShell!)) {
        expectFits(text, appShellRole(path), locale, path.startsWith('staff.') ? 'adult' : '6-9', `appShell.${path}`);
      }
      for (const [path, text] of flatten(strings.siteShell!)) expectFits(text, siteShellRole(path), locale, 'adult', `siteShell.${path}`);
      // Settings' mode and sign-out, read by every signed-in account from 6 years old.
      for (const [key, text] of Object.entries(strings.sessionPreferences as Record<string, string>)) {
        const role = key === 'title' ? 'heading' : key === 'theme' ? 'body' : key.startsWith('theme') ? 'option' : 'action';
        expectFits(text, role, locale, '6-9', `sessionPreferences.${key}`);
      }
      // A child can land on a broken link: the youngest budget.
      for (const [key, text] of Object.entries(strings.notFound as Record<string, string>)) {
        expectFits(text, key === 'title' ? 'heading' : key === 'body' ? 'body' : 'action', locale, '6-9', `notFound.${key}`);
      }
    });
  }
});
