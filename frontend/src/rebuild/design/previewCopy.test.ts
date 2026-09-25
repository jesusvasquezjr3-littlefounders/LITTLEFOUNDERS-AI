import { describe, expect, it } from 'vitest';
import en from '../../i18n/en-US/rebuild.json';
import es from '../../i18n/es-MX/rebuild.json';
import pt from '../../i18n/pt-BR/rebuild.json';
import { checkCopy, type CopyRole, type Locale } from './copyBudget';

const roles: Record<Exclude<keyof typeof en, 'ageScreen' | 'mentorCalibration' | 'analyticsChoice' | 'socialGraph' | 'socialHistory' | 'socialRequest' | 'socialRequests' | 'badgeShares' | 'socialNotices' | 'memorySelfReview' | 'kidSuspended' | 'guardianInvite' | 'mentorSessionEnd' | 'mentorCheckIn'>, CopyRole> = {
  preview: 'body', heading: 'heading', intro: 'body', practice: 'action', controls: 'action',
  lessonDemo: 'action', lessonUnavailable: 'heading', lessonInvalid: 'heading', timelineDemo: 'action', numberLineDemo: 'action', age: 'body', adult: 'option',
  question: 'prompt', save: 'option', spend: 'option', check: 'action', again: 'action',
  correct: 'body', hint: 'body', back: 'action', name: 'body', nameHint: 'body',
  confirm: 'action', confirmed: 'body', required: 'body', theme: 'body', light: 'option',
  dark: 'option', language: 'body',
};
describe('new preview copy', () => {
  for (const [locale, strings] of Object.entries({ 'en-US': en, 'es-MX': es, 'pt-BR': pt })) {
    it(`fits the youngest copy budget in ${locale}`, () => {
      expect(Object.keys(strings).filter(key => key !== 'ageScreen' && key !== 'mentorCalibration' && key !== 'analyticsChoice' && key !== 'socialGraph' && key !== 'socialHistory' && key !== 'socialRequest' && key !== 'socialRequests' && key !== 'badgeShares' && key !== 'socialNotices' && key !== 'memorySelfReview' && key !== 'kidSuspended' && key !== 'guardianInvite' && key !== 'mentorSessionEnd' && key !== 'mentorCheckIn').sort()).toEqual(Object.keys(roles).sort());
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
      for (const [key, text] of Object.entries(strings.memorySelfReview)) {
        const role = key === 'title' ? 'heading' : ['approve', 'delete', 'retry'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `memorySelfReview.${key}`).toEqual([]);
      }
      // C.8/C.12 + C.16: the Mentor's session-end choice and closing state, for the youngest band.
      for (const [key, value] of Object.entries(strings.mentorSessionEnd)) {
        const entries: [string, string][] = typeof value === 'string' ? [[key, value]] : Object.entries(value).map(([k, v]) => [`${key}.${k}`, v]);
        for (const [path, text] of entries) {
          const role = path.endsWith('Title') ? 'heading'
            : ['stop', 'more', 'backToPath'].includes(path) ? 'action' : path === 'previewTopic' ? 'data' : 'body';
          expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '6-9', surface: 'app' }), `mentorSessionEnd.${path}`).toEqual([]);
        }
      }
      // C.19: the check-in reply chips are option controls (Bible 08 §2: 5 words for ages 6–9).
      for (const [key, text] of Object.entries(strings.mentorCheckIn)) {
        const role = key === 'choiceLabel' ? 'body' : 'option';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '6-9', surface: 'app' }), `mentorCheckIn.${key}`).toEqual([]);
      }
      for (const [key, text] of Object.entries(strings.ageScreen)) {
        const role = key === 'title' ? 'heading' : ['continue', 'exit', 'retry'].includes(key) ? 'action' : 'body';
        expect(checkCopy(text, role, { locale: locale as Locale, ageBand: '6-9', surface: 'app' }), `ageScreen.${key}`).toEqual([]);
      }
    });
  }
});
