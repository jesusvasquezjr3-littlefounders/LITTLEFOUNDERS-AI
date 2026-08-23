/**
 * `<html lang>` FOLLOWS THE LEARNER.
 *
 * `index.html` ships `lang="en"`, and for the whole life of the app nothing
 * changed it — so every Spanish and Portuguese screen declared itself English
 * to the one consumer that cannot see the words. A screen reader takes its
 * voice and its pronunciation rules from this attribute, which means a child
 * on the Spanish Tutor heard Spanish spoken by an English synthesiser.
 *
 * This is a one-line side effect with no visible surface, which is exactly the
 * kind of thing that silently regresses when someone reorganises `i18n/index`.
 * Hence a test rather than a comment.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import i18n, { LOCALES } from './index';

describe('the document declares the language it is written in', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en-US');
  });

  it('is set before anything renders, not by a component effect', () => {
    // `index.ts` publishes at module scope, so importing it is enough.
    expect(document.documentElement.getAttribute('lang')).toBeTruthy();
  });

  it.each(LOCALES)('follows a change to %s', async (locale) => {
    await i18n.changeLanguage(locale);
    expect(document.documentElement.getAttribute('lang')).toBe(locale);
  });

  it('narrows a region we do not ship to the locale actually in use', async () => {
    // i18next can resolve a detected `es` or `pt-PT`; the tag written must be
    // one of ours, never a language we have no resources for.
    await i18n.changeLanguage('es');
    expect(document.documentElement.getAttribute('lang')).toBe('es-MX');
    await i18n.changeLanguage('pt-PT');
    expect(document.documentElement.getAttribute('lang')).toBe('pt-BR');
  });

  it('falls back to en-US rather than leaving a stale tag', async () => {
    await i18n.changeLanguage('es-MX');
    await i18n.changeLanguage('zz');
    expect(document.documentElement.getAttribute('lang')).toBe('en-US');
  });
});
