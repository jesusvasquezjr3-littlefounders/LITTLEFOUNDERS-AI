import { describe, expect, it } from 'vitest';
import { metaFor, PAGES } from '../../../../scripts/seo/site.mjs';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { legalDocument } from '@/rebuild/site/legalContent';

/*
 * The prerendered page a crawler or an unfurler reads (scripts/seo/build-seo.mjs)
 * must be the page a person sees (serving crawlers other content is cloaking):
 * each public page's <h1> in site.mjs is the rebuilt page's own <h1>, in every
 * locale, and no public page's title or description says what the product
 * does not (OD-5 "free to start", OD-6 "Tutor" is only the verified parent).
 */

const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;

function pageH1(path: string, locale: (typeof LOCALES)[number]): string | null {
  const site = rebuildNamespaceCopy[locale].site;
  if (path === '/') return site.landing.title;
  if (path === '/how-it-works') return site.howItWorks.title;
  if (path === '/families') return site.families.title;
  if (path === '/faq') return site.faq.title;
  if (path === '/legal/terms') return legalDocument(locale, 'terms').title;
  if (path === '/legal/privacy') return legalDocument(locale, 'privacy').title;
  return null;
}

describe('public site SEO surface', () => {
  for (const locale of LOCALES) {
    it(`prerenders each rebuilt page's own h1 in ${locale}`, () => {
      for (const page of PAGES.filter((entry) => entry.index)) {
        expect(metaFor(page, locale).h1, `${page.path} ${locale}`).toBe(pageH1(page.path, locale));
      }
    });

    it(`says nothing the product does not back in ${locale}`, () => {
      for (const page of PAGES) {
        const { title, description, h1 } = metaFor(page, locale);
        const text = `${title} ${description} ${h1}`;
        expect(text, page.path).not.toMatch(/—/);
        expect(text, page.path).not.toMatch(/always free|forever free|free to stay|siempre gratis|gratis para quedarte|sempre grátis/i);
        expect(text, page.path).not.toMatch(/\btutor (that|que) (answers|responde)|AI Tutor|Tutor (de )?IA|conversation with the Tutor|conversación con el Tutor|conversa com o Tutor/i);
      }
    });
  }
});
