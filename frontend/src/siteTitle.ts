import { metaFor, PAGES, SITE } from '../scripts/seo/site.mjs';

/*
 * The landing page's title comes from the one table the build writes into the
 * page's HTML for crawlers (scripts/seo/site.mjs), so the title a search
 * engine renders is the title the browser shows. The shell appends the
 * product name itself, so the table's own " | LittleFounders" suffix is
 * dropped here.
 */
export function landingTitle(locale: string): string {
  const page = PAGES.find((entry) => entry.path === '/');

  if (!page) return '';
  const suffix = ` | ${SITE.name}`;
  const title = metaFor(page, locale).title;

  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}
