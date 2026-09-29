import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ButtonLink, IconButton } from './buttons';
import type { Locale } from './copyBudget';
import { findMentorAvatar, MENTOR_NAMES, resolveManifestAsset, type MentorCharacter } from './assets';
import { MentorAvatar, Pill } from './display';
import { useRebuildEnvironment } from './layers';
import { Sheet } from './overlays';
import { replayRouteEntrance } from './motion';
import './shells.css';

/*
 * Shared shells (Frontend Bible 02 §1.1, §4.5, §7 rule 9, §9.7, §9.8; 03 §3.4;
 * S03.2). One design system, separate experiences (OD-3, OD-4): the learner
 * app, the parent (Tutor) console, the staff console, the public site and the
 * sign-in flow each get their own navigation from the same components. Every
 * shell provides a skip link, one <main>, route-level focus (a route change
 * scrolls to the top and focuses the new page's heading; an in-place re-render
 * never does), the document title and the document language. Layout changes by
 * the `app` container width, never the viewport, and respects the safe areas.
 *
 * Navigation hides what a person cannot open; it never authorises anything.
 * Every destination is still enforced by its route guard and by the Core API.
 */

export interface ShellNavItem {
  id: string;
  label: string;
  href: string;
  /** A class B navigation icon from the asset manifest (07 §1). Generic glyphs never stand for a place. */
  iconAssetId?: string;
}

export interface ShellCommonProps {
  /** The product name, used in the document title and the wordmark. */
  appName: string;
  /** This page's own title; the document title becomes "{pageTitle} · {appName}". */
  pageTitle: string;
  /** Changes exactly when the route changes. */
  routeKey: string;
  locale: Locale;
  labels: { skip: string; navigation: string };
  /** Client-side navigation. Without it, links load the page normally. */
  onNavigate?: (href: string) => void;
  /** The page. It carries exactly one <h1>. */
  children: ReactNode;
}

/** Document title and language follow the page (WCAG 2.4.2, 3.1.1). */
export function useDocumentMeta(pageTitle: string, appName: string, locale: Locale) {
  useEffect(() => { document.title = pageTitle ? `${pageTitle} · ${appName}` : appName; }, [pageTitle, appName]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
}

/**
 * On a route change (never on the first render and never on an in-place
 * re-render): scroll to the top and move focus to the new page's <h1>, or to
 * <main> when there is none, so a keyboard or screen-reader user starts on the
 * new content instead of on the link they pressed (02 rule 13).
 */
export function useRouteFocus(routeKey: string, main: React.RefObject<HTMLElement>) {
  // The key the page last settled on, not a "first render" flag: React's development StrictMode runs every
  // effect twice on mount, and a flag let the second run treat the first load as a route change (W2: found
  // on the real routes, where the first Tab then skipped the skip link).
  const settled = useRef(routeKey);
  useEffect(() => {
    if (settled.current === routeKey) return;
    settled.current = routeKey;
    window.scrollTo(0, 0);
    replayRouteEntrance(main.current);
    const target = main.current?.querySelector<HTMLElement>('h1') ?? main.current;
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }, [routeKey]);
}

function isPlainClick(event: MouseEvent) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function linkHandler(href: string, onNavigate?: (href: string) => void, after?: () => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    after?.();
    if (!onNavigate || !isPlainClick(event)) return;
    event.preventDefault();
    onNavigate(href);
  };
}

/** The first stop on every page: visible only while focused, it moves focus to <main>. */
export function SkipLink({ label, target }: { label: string; target: string }) {
  return <a className="lf-skip-link" href={`#${target}`} data-copy-role="action" onClick={(event) => {
    const main = document.getElementById(target);
    if (!main) return;
    event.preventDefault();
    main.focus();
  }}>{label}</a>;
}

/** The wordmark. It is the approved brand name, so it is `brand` copy and never budgeted or translated. */
export function BrandMark({ name, href, onNavigate }: { name: string; href?: string; onNavigate?: (href: string) => void }) {
  return href
    ? <a className="lf-brand-mark" href={href} data-copy-role="brand" onClick={linkHandler(href, onNavigate)}>{name}</a>
    : <span className="lf-brand-mark" data-copy-role="brand">{name}</span>;
}

function NavIcon({ asset }: { asset: NonNullable<ReturnType<typeof resolveManifestAsset>> }) {
  return <img className="lf-nav-icon" src={asset.path} alt="" aria-hidden="true" data-asset-id={asset.id} />;
}

interface NavEntry extends ShellNavItem {
  icon?: ReactNode;
  labelRole?: 'action' | 'data';
  /**
   * The entry keeps its visible word in the compact tab bar. Only the Mentor tab before a character is chosen:
   * it has no picture (never a stand-in, 02 rule 21), so its word is its only visible mark.
   */
  keepLabel?: boolean;
}

/**
 * `data-icons='all'` switches on the compact phone tab bar below a 360 px container (02 section 7 rule 9): every
 * entry has its own mark, or is the unchosen Mentor, which keeps its word. The current entry is marked on its
 * list item, so the compact rule needs no `:has()`.
 */
export function navIconCoverage(items: readonly Pick<NavEntry, 'icon' | 'keepLabel'>[]): 'all' | 'partial' {
  return items.length > 0 && items.every((item) => item.icon || item.keepLabel) ? 'all' : 'partial';
}

function NavLinks({ items, current, variant, onNavigate, onFollow }: {
  items: readonly NavEntry[]; current: string; variant: 'tab' | 'rail' | 'sheet'; onNavigate?: (href: string) => void; onFollow?: () => void;
}) {
  return <ul className={`lf-nav-list lf-nav-list--${variant}`} data-icons={navIconCoverage(items)}>
    {items.map((item) => <li key={item.id} className="lf-nav-entry" data-current={item.id === current ? '' : undefined}
      data-keep-label={item.keepLabel ? '' : undefined}>
      <a className={`lf-nav-link lf-nav-link--${variant}`} href={item.href} aria-current={item.id === current ? 'page' : undefined}
        data-nav-id={item.id} onClick={linkHandler(item.href, onNavigate, onFollow)}>
        {item.icon ? <span className="lf-nav-icon-slot">{item.icon}</span> : null}
        <span className="lf-nav-label" data-copy-role={item.labelRole ?? 'action'}>{item.label}</span>
      </a>
    </li>)}
  </ul>;
}

/** Each item's class B mark, resolved from the manifest; an id the manifest does not hold (or a retired one) gives no icon. */
function withIcons(items: readonly ShellNavItem[]): NavEntry[] {
  return items.map((item) => {
    const asset = item.iconAssetId ? resolveManifestAsset(item.iconAssetId) : null;
    return { ...item, icon: asset ? <NavIcon asset={asset} /> : undefined };
  });
}

/** Shared frame pieces: skip link, document meta, route focus and the <main> element. */
function useShellFrame({ pageTitle, appName, locale, routeKey }: Pick<ShellCommonProps, 'pageTitle' | 'appName' | 'locale' | 'routeKey'>) {
  const mainId = `${useId().replace(/:/g, '')}-main`;
  const main = useRef<HTMLElement>(null);
  useDocumentMeta(pageTitle, appName, locale);
  useRouteFocus(routeKey, main);
  return { mainId, main };
}

/* ---------------------------------------------------------------------------
 * Learner app shell
 * ------------------------------------------------------------------------- */

export interface LearnerShellProps extends ShellCommonProps {
  /** Learn, Tasks, Wallet, Profile… as this learner is entitled to them (a teen without a parent has no Tasks, OD-3). */
  items: readonly ShellNavItem[];
  /**
   * The Mentor tab (02 §1.1, §9.7, OD-6): the chosen character's own name
   * (from `MENTOR_NAMES`, so the name can never disagree with the picture) and
   * a render of the real model. `name` is the translated generic word
   * "Mentor", shown only before a character is chosen, with no stand-in picture.
   */
  mentor: { href: string; name: string; character: MentorCharacter | null };
  /** Where the Mentor tab sits among the items (the mockup's order puts it second). */
  mentorIndex?: number;
  current: string;
}

/**
 * The learner app: a bottom tab bar docked in the thumb zone on phones and
 * tablets (03 §3.4), a side rail from an 840 px container. Below 360 px, when
 * every tab has its own icon, inactive tabs become 48 px icons and only the
 * current tab keeps a visible label (02 §7 rule 9); the name of every tab
 * stays in the accessibility tree. The Mentor tab before a character is chosen
 * has no picture (02 rule 21), so it keeps its word too. Without icons the
 * labels wrap instead of shrinking.
 */
export function LearnerShell({ items, mentor, mentorIndex = 1, current, labels, onNavigate, children, ...frame }: LearnerShellProps) {
  const { mainId, main } = useShellFrame(frame);
  const { theme } = useRebuildEnvironment();
  const avatarId = mentor.character ? findMentorAvatar(mentor.character, theme) : null;
  const mentorEntry: NavEntry = {
    id: 'mentor', label: mentor.character ? MENTOR_NAMES[mentor.character] : mentor.name, href: mentor.href, labelRole: mentor.character ? 'data' : 'action',
    icon: avatarId ? <MentorAvatar renderId={avatarId} label={null} size="xs" /> : undefined, keepLabel: !avatarId,
  };
  const entries = withIcons(items);
  entries.splice(Math.min(Math.max(mentorIndex, 0), entries.length), 0, mentorEntry);
  return <div className="lf-shell lf-shell--learner" data-shell="learner" lang={frame.locale}>
    <SkipLink label={labels.skip} target={mainId} />
    <div className="lf-shell-frame">
      <nav className="lf-shell-rail" aria-label={labels.navigation}>
        <BrandMark name={frame.appName} />
        <NavLinks items={entries} current={current} variant="rail" onNavigate={onNavigate} />
      </nav>
      <main ref={main} id={mainId} tabIndex={-1} className="lf-shell-main">{children}</main>
    </div>
    <nav className="lf-tabbar" aria-label={labels.navigation} data-dock>
      <NavLinks items={entries} current={current} variant="tab" onNavigate={onNavigate} />
    </nav>
  </div>;
}

/* ---------------------------------------------------------------------------
 * Console shells: the parent (Tutor) and staff
 * ------------------------------------------------------------------------- */

export interface ConsoleShellProps extends ShellCommonProps {
  kind: 'tutor' | 'staff';
  /** The role pill: "Tutor" (the verified parent, OD-6) or the staff role name. */
  roleLabel: string;
  items: readonly ShellNavItem[];
  current: string;
  labels: ShellCommonProps['labels'] & { menu: string; close: string };
}

/** At most this many destinations fit the phone tab bar at 64 px; more move into a menu sheet. */
export const CONSOLE_TAB_LIMIT = 5;

/** A console: an app bar with the brand and role on phones, a side rail from 840 px. */
export function ConsoleShell({ kind, roleLabel, items, current, labels, onNavigate, children, ...frame }: ConsoleShellProps) {
  const { mainId, main } = useShellFrame(frame);
  const [menuOpen, setMenuOpen] = useState(false);
  const entries = withIcons(items);
  const tabs = entries.length <= CONSOLE_TAB_LIMIT;
  return <div className={`lf-shell lf-shell--console lf-shell--${kind}`} data-shell={kind} lang={frame.locale}>
    <SkipLink label={labels.skip} target={mainId} />
    <header className="lf-appbar">
      <BrandMark name={frame.appName} />
      <Pill tone="primary">{roleLabel}</Pill>
      {!tabs ? <IconButton glyph="menu" label={labels.menu} aria-expanded={menuOpen} aria-haspopup="dialog" className="lf-appbar-menu"
        onClick={() => setMenuOpen(true)} /> : null}
    </header>
    <div className="lf-shell-frame">
      <nav className="lf-shell-rail" aria-label={labels.navigation}>
        <BrandMark name={frame.appName} />
        <Pill tone="primary">{roleLabel}</Pill>
        <NavLinks items={entries} current={current} variant="rail" onNavigate={onNavigate} />
      </nav>
      <main ref={main} id={mainId} tabIndex={-1} className="lf-shell-main">{children}</main>
    </div>
    {tabs
      ? <nav className="lf-tabbar" aria-label={labels.navigation} data-dock>
        <NavLinks items={entries} current={current} variant="tab" onNavigate={onNavigate} />
      </nav>
      : <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} heading={labels.navigation} closeLabel={labels.close} placement="full"
        headingHidden headerStart={<><BrandMark name={frame.appName} /><Pill tone="primary">{roleLabel}</Pill></>}>
        <nav aria-label={labels.navigation}>
          <NavLinks items={entries} current={current} variant="sheet" onNavigate={onNavigate} onFollow={() => setMenuOpen(false)} />
        </nav>
      </Sheet>}
  </div>;
}

/** The verified parent's console. "Tutor" names the parent, never the AI (OD-6). */
export function TutorShell(props: Omit<ConsoleShellProps, 'kind'>) {
  return <ConsoleShell {...props} kind="tutor" />;
}

/**
 * Staff permissions, mirrored by hand from Core's `requireAdminPermission`
 * (backend/src/middleware/auth.ts). There are no shared types across packages
 * by design; a unit test fails when the two lists drift.
 */
export const STAFF_PERMISSIONS = ['manage_users', 'manage_content', 'view_analytics', 'manage_support'] as const;
export type StaffPermission = typeof STAFF_PERMISSIONS[number];
export interface StaffGrants { superadmin: boolean; permissions: readonly StaffPermission[] }
export interface StaffNavItem extends ShellNavItem {
  /** The item shows when any one of these is granted. Omit only for destinations every staff role can open. */
  permission?: StaffPermission | readonly StaffPermission[];
}

/** The navigation a staff member can open: superadmins see everything, everyone else only what they are granted. */
export function permittedStaffItems(items: readonly StaffNavItem[], grants: StaffGrants): StaffNavItem[] {
  if (grants.superadmin) return [...items];
  return items.filter((item) => {
    if (!item.permission) return true;
    const needed: readonly StaffPermission[] = typeof item.permission === 'string' ? [item.permission] : item.permission;
    return needed.some((permission) => grants.permissions.includes(permission));
  });
}

/** The staff console: permission-aware navigation slots over the shared console shell. */
export function StaffShell({ items, grants, ...props }: Omit<ConsoleShellProps, 'kind' | 'items'> & { items: readonly StaffNavItem[]; grants: StaffGrants }) {
  return <ConsoleShell {...props} kind="staff" items={permittedStaffItems(items, grants)} />;
}

/* ---------------------------------------------------------------------------
 * Public site and sign-in
 * ------------------------------------------------------------------------- */

export interface ShellLinkAction { label: string; href: string }

export interface SiteShellProps extends ShellCommonProps {
  homeHref: string;
  links: readonly ShellNavItem[];
  current?: string;
  /** "Log in": a secondary link. */
  secondaryAction?: ShellLinkAction;
  /** "Start free": the one accent call to action in the header. */
  primaryAction?: ShellLinkAction;
  /** On phones, a bar with this action docks at the bottom after the first screen (03 §3.4). */
  stickyAction?: ShellLinkAction;
  footer?: ReactNode;
  labels: ShellCommonProps['labels'] & { menu: string; close: string };
}

/**
 * The public site: a sticky header (z 30); links inline from a 1120 px
 * container (02 §11 item 8), a menu sheet below it (z 50); the call to action
 * inline from 640 px and in the menu below it.
 */
export function SiteShell({ homeHref, links, current = '', secondaryAction, primaryAction, stickyAction, footer, labels, onNavigate, children, ...frame }: SiteShellProps) {
  const { mainId, main } = useShellFrame(frame);
  const [menuOpen, setMenuOpen] = useState(false);
  const [docked, setDocked] = useState(false);
  useEffect(() => {
    if (!stickyAction) return;
    const update = () => setDocked(window.scrollY > window.innerHeight * 0.6);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [stickyAction]);
  const follow = (href: string) => linkHandler(href, onNavigate, () => setMenuOpen(false));
  return <div className="lf-shell lf-shell--site" data-shell="site" lang={frame.locale}>
    <SkipLink label={labels.skip} target={mainId} />
    <header className="lf-site-header">
      <BrandMark name={frame.appName} href={homeHref} onNavigate={onNavigate} />
      <nav className="lf-site-links" aria-label={labels.navigation}><NavLinks items={links} current={current} variant="rail" onNavigate={onNavigate} /></nav>
      <div className="lf-site-actions">
        {secondaryAction ? <ButtonLink size="sm" href={secondaryAction.href} onClick={follow(secondaryAction.href)}>{secondaryAction.label}</ButtonLink> : null}
        {primaryAction ? <ButtonLink size="sm" variant="accent" href={primaryAction.href} onClick={follow(primaryAction.href)}>{primaryAction.label}</ButtonLink> : null}
      </div>
      <IconButton glyph="menu" label={labels.menu} className="lf-site-menu" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen(true)} />
    </header>
    <main ref={main} id={mainId} tabIndex={-1} className="lf-shell-main">{children}</main>
    {footer ? <footer className="lf-site-footer">{footer}</footer> : null}
    {stickyAction ? <div className="lf-sticky-action" data-visible={docked} data-dock={docked ? '' : undefined}>
      <ButtonLink size="lg" variant="accent" href={stickyAction.href} onClick={follow(stickyAction.href)}>{stickyAction.label}</ButtonLink>
    </div> : null}
    <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} heading={labels.navigation} closeLabel={labels.close} placement="full"
      headingHidden headerStart={<BrandMark name={frame.appName} />}
      footer={primaryAction || secondaryAction ? <div className="lf-sheet-actions">
        {primaryAction ? <ButtonLink size="lg" variant="accent" href={primaryAction.href} onClick={follow(primaryAction.href)}>{primaryAction.label}</ButtonLink> : null}
        {secondaryAction ? <ButtonLink size="lg" href={secondaryAction.href} onClick={follow(secondaryAction.href)}>{secondaryAction.label}</ButtonLink> : null}
      </div> : undefined}>
      <nav aria-label={labels.navigation}>
        <NavLinks items={links} current={current} variant="sheet" onNavigate={onNavigate} onFollow={() => setMenuOpen(false)} />
      </nav>
    </Sheet>
  </div>;
}

/** Sign-up, log-in and recovery: the brand, one optional way back, one column. */
export function AuthShell({ homeHref, back, footer, labels, onNavigate, children, ...frame }: Omit<ShellCommonProps, 'labels'> & {
  homeHref: string; back?: ShellLinkAction; footer?: ReactNode; labels: { skip: string };
}) {
  const { mainId, main } = useShellFrame(frame);
  return <div className="lf-shell" data-shell="auth" lang={frame.locale}>
    <SkipLink label={labels.skip} target={mainId} />
    <header className="lf-auth-header">
      <BrandMark name={frame.appName} href={homeHref} onNavigate={onNavigate} />
      {back ? <ButtonLink size="sm" href={back.href} onClick={linkHandler(back.href, onNavigate)}>{back.label}</ButtonLink> : null}
    </header>
    <main ref={main} id={mainId} tabIndex={-1} className="lf-shell-main lf-auth-main"><div className="lf-auth-column">{children}</div></main>
    {footer ? <footer className="lf-auth-footer">{footer}</footer> : null}
  </div>;
}

/* ---------------------------------------------------------------------------
 * Single-state screen and the responsive table
 * ------------------------------------------------------------------------- */

/**
 * A dashboard page (02 §4.5: a neutral page with coloured cards). From an
 * 840 px container of its own it splits 7:5 (03 §3.3: asymmetry with a reason,
 * the main task wide and the supporting column narrow); below that it is one
 * reading column in source order. Without a supporting column the main task
 * keeps the full width (a data table needs it to stay a table, 02 §9.8).
 */
export function DashboardLayout({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return <div className="lf-dashboard">
    <div className={`lf-dashboard-grid${secondary ? ' lf-dashboard-grid--split' : ''}`}>
      <div className="lf-dashboard-primary">{primary}</div>
      {secondary ? <div className="lf-dashboard-secondary">{secondary}</div> : null}
    </div>
  </div>;
}

export type SingleStateHue = 'primary' | 'accent' | 'success' | 'sky' | 'mint' | 'berry' | 'reward';

/**
 * A screen that is one state (a lesson, a result, an onboarding step) fills
 * its whole background with one hue (02 §4.5, rule 15). Text and controls use
 * that hue's `on-*` colour, and so does the focus ring. Actions dock at the
 * bottom, in the thumb zone, above the safe area.
 */
export function SingleStateScreen({ hue, bar, actions, labels, children, ...frame }: Omit<ShellCommonProps, 'labels' | 'onNavigate'> & {
  hue: SingleStateHue; bar?: ReactNode; actions?: ReactNode; labels: { skip: string };
}) {
  const { mainId, main } = useShellFrame(frame);
  return <div className={`lf-shell lf-single-state lf-single-state--${hue}`} data-shell="single-state" data-hue={hue} lang={frame.locale}>
    <SkipLink label={labels.skip} target={mainId} />
    {bar ? <div className="lf-single-state-bar">{bar}</div> : null}
    <main ref={main} id={mainId} tabIndex={-1} className="lf-single-state-main">{children}</main>
    {actions ? <div className="lf-single-state-actions" data-dock>{actions}</div> : null}
  </div>;
}

export interface TableColumn<Row> {
  key: string;
  label: string;
  value: (row: Row) => ReactNode;
  /** Names, nicknames and emails wrap anywhere (02 §7 rule 8). */
  ugc?: boolean;
}

/**
 * A data table that becomes one card per row below an 840 px container
 * (02 §9.8). Each cell keeps its label visible as "label: value", nothing is
 * truncated, and explicit table roles keep the semantics when CSS changes the
 * display of the table elements.
 */
export function DataTable<Row>({ caption, columns, rows, rowKey }: {
  caption: string; columns: readonly TableColumn<Row>[]; rows: readonly Row[]; rowKey: (row: Row) => string;
}) {
  return <div className="lf-table-wrap">
    <table className="lf-table" role="table">
      <caption className="lf-table-caption" data-copy-role="heading">{caption}</caption>
      <thead className="lf-table-head" role="rowgroup">
        <tr role="row">{columns.map((column) => <th key={column.key} scope="col" role="columnheader" data-copy-role="body">{column.label}</th>)}</tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((row) => <tr key={rowKey(row)} role="row" className="lf-table-row">
          {columns.map((column) => <td key={column.key} role="cell" className="lf-table-cell">
            <span className="lf-table-label" aria-hidden="true" data-copy-role="body">{column.label}</span>
            <span className={`lf-table-value${column.ugc ? ' ugc' : ''}`} data-copy-role="data">{column.value(row)}</span>
          </td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}
