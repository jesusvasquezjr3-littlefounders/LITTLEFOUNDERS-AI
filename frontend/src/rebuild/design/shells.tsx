import { useEffect, useId, type ReactNode } from 'react';
import { resolveManifestAsset } from './assets';
import type { Locale } from './copyBudget';
import './shells.css';
import './siteTopbar.css';

/*
 * The site shell: a skip link, one <main>, the document title and language,
 * a header with the brand and the display controls, and a footer. Layout
 * changes by the `app` container width, never the viewport, and respects the
 * safe areas.
 */

/** Document title and language follow the page (WCAG 2.4.2, 3.1.1). */
function useDocumentMeta(pageTitle: string, appName: string, locale: Locale) {
  useEffect(() => { document.title = pageTitle ? `${pageTitle} · ${appName}` : appName; }, [pageTitle, appName]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
}

/** The first stop on every page: visible only while focused, it moves focus to <main>. */
function SkipLink({ label, target }: { label: string; target: string }) {
  return <a className="lf-skip-link" href={`#${target}`} data-copy-role="action" onClick={(event) => {
    const main = document.getElementById(target);
    if (!main) return;
    event.preventDefault();
    main.focus();
  }}>{label}</a>;
}

/** The wordmark. It is the approved brand name, so it is `brand` copy and never budgeted or translated. */
function BrandMark({ name, href }: { name: string; href: string }) {
  const asset = resolveManifestAsset('brand.logo');
  const content = asset ? <img className="lf-brand-wordmark" src="/rebuild/brand/logo.png" alt={name} width={560} height={102} data-asset-id={asset.id} /> : null;
  return <a className="lf-brand-mark" href={href} data-copy-role="brand">{content}</a>;
}

export interface SiteShellProps {
  /** The product name, used in the document title and the wordmark. */
  appName: string;
  /** This page's own title; the document title becomes "{pageTitle} · {appName}". */
  pageTitle: string;
  locale: Locale;
  homeHref: string;
  labels: { skip: string };
  /** The page. It carries exactly one <h1>. */
  children: ReactNode;
  /** The display controls beside the brand. */
  utilities?: ReactNode;
  footer?: ReactNode;
}

/** The public site: a sticky header with the brand and the display controls, the page, and a footer. */
export function SiteShell({ appName, pageTitle, locale, homeHref, labels, children, utilities, footer }: SiteShellProps) {
  const mainId = `${useId().replace(/:/g, '')}-main`;
  useDocumentMeta(pageTitle, appName, locale);
  return <div className="lf-shell lf-shell--site" data-shell="site" lang={locale}>
    <SkipLink label={labels.skip} target={mainId} />
    <header className="lf-site-header"><div className="lf-site-header-inner">
      <BrandMark name={appName} href={homeHref} />
      {utilities}
    </div></header>
    <main id={mainId} tabIndex={-1} className="lf-shell-main">{children}</main>
    {footer ? <footer className="lf-site-footer">{footer}</footer> : null}
  </div>;
}
