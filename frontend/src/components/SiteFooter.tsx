import { Button } from '@/components/ui/button';
import { openCookiePreferences } from '@/components/CookieConsentBanner';
import { SOCIAL_GLYPHS } from '@/components/icons/social';
import { useCoreCopy } from '@/i18n/useCopy';
import { LEGAL, SOCIAL } from '@/lib/footerLinks';

/*
 * The site footer: black in every theme, white text. The logo in white, then the titles of four
 * columns (About us, Product, Behind the scenes, Follow us) and, at the very bottom in small type,
 * the terms, the privacy notice, the cookie preferences, the contact address and the copyright.
 *
 * The first three columns are only titles for now: their links come with the pages they will point
 * to. The social column holds the marks, which are shown but are not links until their address is
 * set (src/lib/footerLinks.ts); each carries its name for assistive technology and shows none.
 * Legal pages with no address yet are shown as text.
 *
 * On the page's grid (4 / 8 / 12 columns: logo 3, About us 2, Product 2, Behind the scenes 2, Follow
 * us 3) and centered on phones like everything else. The logo and the column titles sit on the same
 * line (every one is a 48 px tall box, centered on the same row). Focus rings are white here: the
 * brand outline does not show on black.
 */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

const LINK = `inline-flex min-h-12 items-center text-base font-medium text-white no-underline underline-offset-4 hover:underline ${FOCUS}`;

const STATIC = 'inline-flex min-h-12 items-center text-base font-medium text-white/70';

const MARK = 'inline-flex size-12 items-center justify-center rounded-full text-white';

const GRID = 'mx-auto grid w-full max-w-[1120px] grid-cols-4 gap-x-4 px-4 sm:px-6 md:grid-cols-8 md:gap-x-6 lg:grid-cols-12';

const TITLE = 'flex min-h-12 items-center justify-center text-base font-semibold text-white/70 md:justify-start';

export function SiteFooter() {
  const core = useCoreCopy();
  const copy = core.footer;
  const brand = core.appShell.brand;

  return <footer className="bg-black pb-[calc(4.75rem+env(safe-area-inset-bottom))] text-white md:pb-0">
    <div className={`${GRID} items-start gap-y-2 py-12 text-center md:py-16 md:text-start`}>
      <div className="col-span-4 flex min-h-12 items-center justify-center md:col-span-8 md:justify-start lg:col-span-3">
        <a href="/" aria-label={brand} className={`inline-flex min-h-12 items-center ${FOCUS}`}>
          <img src="/brand/logo-white.png" alt={brand} width={560} height={102} className="h-9 w-auto" />
        </a>
      </div>
      <h2 className={`${TITLE} col-span-4 md:col-span-4 lg:col-span-2`}>{copy.about}</h2>
      <h2 className={`${TITLE} col-span-4 md:col-span-4 lg:col-span-2`}>{copy.product}</h2>
      <h2 className={`${TITLE} col-span-4 md:col-span-4 lg:col-span-2`}>{copy.behind}</h2>
      <div className="col-span-4 md:col-span-4 lg:col-span-3">
        <h2 className={TITLE}>{copy.follow}</h2>
        <ul className="flex flex-wrap justify-center md:-ms-3 md:justify-start">
          {SOCIAL.map(({ key, href }) => {
            const Glyph = SOCIAL_GLYPHS[key];
            const name = copy.social[key];

            return <li key={key}>{href
              ? <a href={href} aria-label={name} target="_blank" rel="noopener noreferrer" className={`${MARK} hover:bg-white/15 ${FOCUS}`}><Glyph className="size-6" /></a>
              : <span role="img" aria-label={name} className={MARK}><Glyph className="size-6" /></span>}
            </li>;
          })}
        </ul>
      </div>
    </div>
    <div className="border-t border-white/20">
      <div className={`${GRID} gap-y-3 py-8 text-center md:text-start`}>
        <nav aria-label={core.siteShell.legal} className="col-span-4 flex flex-wrap items-center justify-center gap-x-6 md:col-span-8 md:justify-start lg:col-span-12">
          {([['terms', copy.terms], ['privacy', copy.privacy]] as const).map(([key, label]) => LEGAL[key]
            ? <a key={key} href={LEGAL[key]} className={LINK}>{label}</a>
            : <span key={key} className={STATIC}>{label}</span>)}
          <Button type="button" variant="ghost" size="sm" className="!px-0 !text-base !text-white hover:!bg-transparent hover:underline focus-visible:!outline-white" onClick={openCookiePreferences}>{core.siteShell.cookies}</Button>
          <a href={`mailto:${core.siteShell.contactEmail}`} className={`${LINK} break-all`}>{core.siteShell.contactEmail}</a>
        </nav>
        <p className="col-span-4 text-base font-medium text-white/70 md:col-span-8 lg:col-span-12">© {new Date().getFullYear()} {brand}. {core.siteShell.rights}</p>
      </div>
    </div>
  </footer>;
}
