import { describe, expect, it } from 'vitest';
import en from '../../i18n/en-US/rebuild.json';
import es from '../../i18n/es-MX/rebuild.json';
import pt from '../../i18n/pt-BR/rebuild.json';
import { checkCopy, type CopyRole, type Locale } from './copyBudget';

const roles: Record<Exclude<keyof typeof en, 'ageScreen' | 'mentorCalibration' | 'analyticsChoice' | 'socialGraph' | 'socialHistory' | 'socialRequest' | 'socialRequests' | 'badgeShares' | 'achievementShare' | 'socialNotices' | 'memorySelfReview' | 'kidSuspended' | 'guardianInvite' | 'accountDeletion' | 'socialRequestTeen' | 'privateProfile' | 'teenConnections' | 'profileSafety' | 'designSystem' | 'designGallery'>, CopyRole> = {
  preview: 'body', heading: 'heading', intro: 'body', practice: 'action', controls: 'action',
  lessonDemo: 'action', lessonUnavailable: 'heading', lessonInvalid: 'heading', timelineDemo: 'action', numberLineDemo: 'action', age: 'body', adult: 'option',
  question: 'prompt', save: 'option', spend: 'option', check: 'action', again: 'action',
  correct: 'body', hint: 'body', back: 'action', name: 'body', nameHint: 'body',
  confirm: 'action', confirmed: 'body', required: 'body', theme: 'body', light: 'option',
  dark: 'option', language: 'body',
};
/** Roles of the S03.1 control catalogue strings, measured at the youngest (6–9) budget. */
function designSystemRole(key: string): CopyRole {
  if (['title', 'buttons', 'fields', 'choices', 'status', 'cards', 'feedback', 'mentor', 'cardTitle', 'courseTitle', 'empty', 'failed'].includes(key)) return 'heading';
  if (['continue', 'saveCoins', 'share', 'help', 'approve', 'remove', 'cancel', 'claim', 'open', 'details', 'saving', 'close', 'menu',
    'show', 'hide', 'less', 'more', 'retryAction', 'retrying'].includes(key)) return 'action';
  if (['pocketSave', 'pocketSpend', 'pocketShare', 'daily', 'weekly', 'on', 'off', 'chart', 'table'].includes(key)) return 'option';
  if (['coinsValue', 'progressValue', 'mentorName'].includes(key)) return 'data';
  return 'body';
}
/** Roles of the S03.2 overlay and shell gallery strings; everything except the public-site pair is measured at the youngest (6–9) budget. */
const designGalleryRoles: Record<string, CopyRole> = {
  ...Object.fromEntries(['title', 'dialogs', 'confirmHeading', 'panels', 'sheetHeading', 'tips', 'messages', 'moreGoals', 'siteHeading', 'singleHeading', 'tableCaption'].map((key) => [key, 'heading'])),
  ...Object.fromEntries(['controls', 'overlays', 'shellLearner', 'shellTeen', 'shellTutor', 'shellStaff', 'shellStaffLimited', 'shellSite', 'shellAuth', 'shellSingle', 'shellTable', 'allComponents', 'openGoal', 'done', 'removeGoal', 'keepGoal', 'removing', 'why', 'moreActions', 'editGoal', 'pauseGoal', 'shareGoal', 'archiveGoal', 'aboutCoins', 'saveGoal', 'showError', 'undo', 'dismiss', 'skip', 'learn', 'tasks', 'wallet', 'profile', 'mentorWord', 'family', 'progress', 'settings', 'overview', 'users', 'content', 'insights', 'reports', 'audit', 'emails', 'howItWorks', 'forFamilies', 'login', 'startFree', 'privacy', 'terms', 'goBack'].map((key) => [key, 'action'])),
  ...Object.fromEntries(['indexBody', 'goalBody', 'confirmBody', 'removed', 'sheetBody', 'whyBody', 'menuDone', 'tipBody', 'saved', 'goalBike', 'goalBook', 'goalGift', 'goalGame', 'goalLeft', 'navigation', 'pageBody', 'tutorRole', 'staffRole', 'siteBody', 'identifier', 'singleBody', 'colName', 'colRole', 'colStatus', 'roleLearner', 'statusActive', 'statusInvited'].map((key) => [key, 'body'])),
};
describe('new preview copy', () => {
  for (const [locale, strings] of Object.entries({ 'en-US': en, 'es-MX': es, 'pt-BR': pt })) {
    it(`fits the youngest copy budget in ${locale}`, () => {
      expect(Object.keys(strings).filter(key => key !== 'ageScreen' && key !== 'mentorCalibration' && key !== 'analyticsChoice' && key !== 'socialGraph' && key !== 'socialHistory' && key !== 'socialRequest' && key !== 'socialRequests' && key !== 'badgeShares' && key !== 'achievementShare' && key !== 'socialNotices' && key !== 'memorySelfReview' && key !== 'kidSuspended' && key !== 'guardianInvite' && key !== 'accountDeletion' && key !== 'socialRequestTeen' && key !== 'privateProfile' && key !== 'teenConnections' && key !== 'profileSafety' && key !== 'designSystem' && key !== 'designGallery').sort()).toEqual(Object.keys(roles).sort());
      for (const key of Object.keys(roles) as (keyof typeof roles)[]) {
        expect(checkCopy(strings[key], roles[key], { locale: locale as Locale, ageBand: '6-9', surface: 'app' }), key).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.mentorCalibration)) {
        const role = key === 'question' ? 'prompt' : ['youngest', 'middle', 'older', 'retry'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '6-9', surface: 'app' }), `mentorCalibration.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.analyticsChoice)) {
        const role = key === 'title' ? 'heading' : key === 'label' ? 'option' : ['on', 'off', 'retry'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `analyticsChoice.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.socialGraph)) {
        const role = ['loading', 'empty', 'failed'].includes(key) ? 'body' : 'action';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `socialGraph.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.socialHistory)) {
        const role = ['title', 'close', 'retry', 'more'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `socialHistory.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.socialRequest)) {
        expect(checkCopy(text, key === 'action' || key === 'saving' ? 'action' : 'body', { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `socialRequest.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.socialRequests)) {
        expect(checkCopy(text, ['title', 'close', 'retry', 'more', 'approve', 'deny'].includes(key) ? 'action' : 'body', { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `socialRequests.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.badgeShares)) {
        const role = ['title', 'close', 'retry', 'revoke'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text.replace('{date}', '20 Sep 2026'), role, { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `badgeShares.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.achievementShare)) {
        // F.3's point-of-action disclosure is budgeted as body copy, never exempted as legal text.
        const role = ['share', 'shareGoal'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `achievementShare.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.socialNotices)) {
        const role = ['title', 'close', 'retry'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text.replace('{name}', 'Ana'), role, { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `socialNotices.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.kidSuspended)) {
        const role = key === 'title' ? 'heading' : 'body';
        expect(checkCopy(text.replace('{email}', 'informame@littlefounders.ai'), role, { locale: locale as Locale, ageBand: '6-9', surface: 'app' }), `kidSuspended.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.guardianInvite)) {
        const role = key === 'title' || key === 'acceptTitle' ? 'heading'
          : ['close', 'invite', 'copy', 'accept'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text.replace('{name}', 'Ana'), role, { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `guardianInvite.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.accountDeletion)) {
        // E.6: every line of the deletion flow, including the layered details, is budgeted; none is exempted as legal text.
        const role = ['title', 'scheduledTitle', 'deletedTitle'].includes(key) ? 'heading'
          : ['start', 'detailsLabel', 'confirm', 'back', 'signInAgain', 'retry', 'keep', 'signIn', 'signOut', 'continue', 'showPassword', 'hidePassword'].includes(key) ? 'action'
            : key === 'acknowledge' ? 'option' : 'body';
        const filled = text.replace('{days}', '14').replace('{count}', '2').replace('{date}', '8 Oct 2026');
        expect(checkCopy(filled, role, { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `accountDeletion.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.socialRequestTeen)) {
        expect(checkCopy(text, key === 'action' || key === 'saving' ? 'action' : 'body', { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `socialRequestTeen.${key}`).toEqual([]);
      }
      // E.8: a child can land on a private teen's card, so it is budgeted for the youngest band.
      for (const [key, text] of Object.entries(strings.privateProfile)) {
        const role = key === 'title' ? 'heading' : key === 'request' || key === 'saving' ? 'action' : 'body';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '6-9', surface: 'app' }), `privateProfile.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.teenConnections)) {
        const role = key === 'title' || key === 'followersTitle' ? 'heading'
          : ['retry', 'accept', 'decline', 'more', 'remove'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `teenConnections.${key}`).toEqual([]);
      }
      // E.13: a child reads its own notice, so the youngest band applies.
      for (const [key, text] of Object.entries(strings.profileSafety)) {
        const role = key === 'title' || key === 'kidTitle' ? 'heading' : 'body';
        expect(checkCopy(text.replace('{name}', 'Ana'), role, { locale: locale as Locale, ageBand: '6-9', surface: 'app' }), `profileSafety.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.designSystem)) {
        expect(checkCopy(text.replace('{n}', '40'), designSystemRole(key), { locale: locale as Locale, ageBand: '6-9', surface: 'app' }), `designSystem.${key}`).toEqual([]);
      }
      expect(Object.keys(strings.designGallery).sort()).toEqual(Object.keys(designGalleryRoles).sort());
      for (const [key, text] of Object.entries(strings.designGallery)) {
        const site = key === 'siteHeading' || key === 'siteBody';
        expect(checkCopy(text, designGalleryRoles[key] ?? 'body', { locale: locale as Locale, ageBand: site ? 'adult' : '6-9', surface: site ? 'site' : 'app' }), `designGallery.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.memorySelfReview)) {
        const role = key === 'title' ? 'heading' : ['approve', 'delete', 'retry'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `memorySelfReview.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.ageScreen)) {
        const role = key === 'title' ? 'heading' : ['continue', 'exit', 'retry'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '6-9', surface: 'app' }), `ageScreen.${key}`).toEqual([]);
      }
    });
  }
});
