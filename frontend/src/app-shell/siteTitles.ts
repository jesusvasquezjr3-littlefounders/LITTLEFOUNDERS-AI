import { metaFor, PAGES, SITE } from '../../scripts/seo/site.mjs';

/*
 * The public pages' titles come from the one table the build writes into each
 * page's HTML for crawlers (scripts/seo/site.mjs). The site shell sets the
 * document title after hydration, so it reads the same table: the title a
 * search engine renders is the title it was served, not a second one kept in
 * step by hand. The shell appends the product name itself, so the table's own
 * " | LittleFounders" suffix is dropped here.
 */
export function sitePageTitle(pathname: string, locale: string): string {
  const page = PAGES.find((entry) => entry.path === pathname);
  if (!page) return '';
  const suffix = ` | ${SITE.name}`;
  const title = metaFor(page, locale).title;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}
