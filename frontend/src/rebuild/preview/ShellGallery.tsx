import { useState, type ReactNode } from 'react';
import {
  AuthShell, Button, ButtonGroup, Card, DashboardLayout, DataTable, IconButton, LearnerShell, List, ListRow, SingleStateScreen, SiteShell, StaffShell, TextField,
  TutorShell, type ShellNavItem, type SingleStateHue, type StaffGrants, type StaffNavItem,
} from '../design/controls';
import type { Locale } from '../design/copyBudget';
import type { GalleryCopy, SystemCopy } from './OverlayGallery';
import './gallery.css';

export type ShellKind = 'learner' | 'teen' | 'tutor' | 'staff' | 'staff-limited' | 'site' | 'auth' | 'single' | 'table';
export const SHELL_KINDS: readonly ShellKind[] = ['learner', 'teen', 'tutor', 'staff', 'staff-limited', 'site', 'auth', 'single', 'table'];

const APP = 'LittleFounders';
const members = [
  { name: 'Sofía', role: 'learner', status: 'active' },
  { name: 'Alessandro_Bartolomeo_Villanueva_Rodriguez_2014', role: 'learner', status: 'invited' },
  { name: 'Ana Lucía', role: 'tutor', status: 'active' },
] as const;

/**
 * Preview-only states of every shared shell (S03.2). Navigation is real:
 * every link changes the route key, so the matrix can check document titles,
 * route focus and scroll reset; the pages are long enough to scroll.
 */
export function ShellGallery({ kind, t, s, locale, onGallery }: {
  kind: ShellKind; t: GalleryCopy; s: SystemCopy; locale: Locale; onGallery: () => void;
}) {
  const initial: Record<ShellKind, string> = { learner: 'learn', teen: 'learn', tutor: 'family', staff: 'overview', 'staff-limited': 'overview',
    site: 'home', auth: 'login', single: 'pick', table: 'family' };
  const [page, setPage] = useState(initial[kind]);
  const navigate = (href: string) => {
    const next = new URL(href, location.href).searchParams.get('page') ?? initial[kind];
    history.pushState(null, '', href);
    setPage(next);
  };
  const href = (id: string) => `?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), page: id }).toString()}`;
  const item = (id: string, label: string): ShellNavItem => ({ id, label, href: href(id) });
  const labels = { skip: t.skip, navigation: t.navigation };
  const common = { appName: APP, routeKey: `${kind}:${page}`, locale, onNavigate: navigate };
  const back = <Button size="sm" onClick={onGallery}>{t.allComponents}</Button>;

  if (kind === 'learner' || kind === 'teen') {
    const items = kind === 'learner'
      ? [item('learn', t.learn), item('tasks', t.tasks), item('wallet', t.wallet), item('profile', t.profile)]
      : [item('learn', t.learn), item('wallet', t.wallet), item('profile', t.profile)];
    const mentor = kind === 'learner' ? { name: 'Dina', character: 'dina' as const } : { name: 'Zara', character: 'zara' as const };
    const title = page === 'mentor' ? mentor.name : items.find((entry) => entry.id === page)?.label ?? t.learn;
    return <LearnerShell {...common} pageTitle={title} labels={labels} items={items} current={page}
      mentor={{ href: href('mentor'), ...mentor }}>
      <Page title={title} titleRole={page === 'mentor' ? 'data' : 'heading'} t={t} action={back} />
    </LearnerShell>;
  }

  if (kind === 'tutor' || kind === 'table') {
    const items = [item('family', t.family), item('tasks', t.tasks), item('progress', t.progress), item('settings', t.settings)];
    const title = items.find((entry) => entry.id === page)?.label ?? t.family;
    return <TutorShell {...common} pageTitle={title} roleLabel={t.tutorRole} items={items} current={page}
      labels={{ ...labels, menu: s.menu, close: s.close }}>
      <h1 data-copy-role="heading">{title}</h1>
      <p data-copy-role="body">{t.pageBody}</p>
      <DashboardLayout primary={kind === 'table' || page === 'family' ? <DataTable caption={t.tableCaption} rowKey={(row) => row.name} rows={members} columns={[
        { key: 'name', label: t.colName, value: (row) => row.name, ugc: true },
        { key: 'role', label: t.colRole, value: (row) => row.role === 'tutor' ? t.tutorRole : t.roleLearner },
        { key: 'status', label: t.colStatus, value: (row) => row.status === 'active' ? t.statusActive : t.statusInvited },
      ]} /> : <Filler t={t} />} secondary={kind === 'table' ? undefined : <Filler t={t} />} />
      {kind === 'table' ? <Filler t={t} /> : null}
      <div>{back}</div>
    </TutorShell>;
  }

  if (kind === 'staff' || kind === 'staff-limited') {
    const items: StaffNavItem[] = [
      { ...item('overview', t.overview) },
      { ...item('users', t.users), permission: 'manage_users' },
      { ...item('content', t.content), permission: 'manage_content' },
      { ...item('insights', t.insights), permission: 'view_analytics' },
      { ...item('reports', t.reports), permission: 'manage_support' },
      { ...item('audit', t.audit), permission: 'manage_support' },
      { ...item('emails', t.emails), permission: 'manage_support' },
    ];
    const grants: StaffGrants = kind === 'staff' ? { superadmin: true, permissions: [] } : { superadmin: false, permissions: ['view_analytics'] };
    const title = items.find((entry) => entry.id === page)?.label ?? t.overview;
    return <StaffShell {...common} pageTitle={title} roleLabel={t.staffRole} items={items} grants={grants} current={page}
      labels={{ ...labels, menu: s.menu, close: s.close }}>
      <Page title={title} t={t} action={back} />
    </StaffShell>;
  }

  if (kind === 'site') {
    const links = [item('how', t.howItWorks), item('families', t.forFamilies)];
    const title = links.find((entry) => entry.id === page)?.label ?? t.siteHeading;
    return <SiteShell {...common} pageTitle={page === 'home' ? '' : title} homeHref={href('home')} links={links} current={page}
      secondaryAction={{ label: t.login, href: href('login') }} primaryAction={{ label: t.startFree, href: href('start') }}
      stickyAction={{ label: t.startFree, href: href('start') }} labels={{ ...labels, menu: s.menu, close: s.close }}
      footer={<nav aria-label={t.navigation} className="lf-gallery-footer-links">
        <a href={href('privacy')} data-copy-role="action">{t.privacy}</a>
        <a href={href('terms')} data-copy-role="action">{t.terms}</a>
      </nav>}>
      <section className="lf-gallery-hero">
        <h1 data-copy-role="heading">{title}</h1>
        <p data-copy-role="body">{t.siteBody}</p>
        <ButtonGroup>{back}</ButtonGroup>
      </section>
      <Filler t={t} />
    </SiteShell>;
  }

  if (kind === 'auth') {
    return <AuthShell {...common} pageTitle={t.shellAuth} homeHref={href('home')} back={{ label: t.goBack, href: href('home') }} labels={{ skip: t.skip }}
      footer={<nav aria-label={t.navigation} className="lf-gallery-footer-links">
        <a href={href('privacy')} data-copy-role="action">{t.privacy}</a>
        <a href={href('terms')} data-copy-role="action">{t.terms}</a>
      </nav>}>
      <h1 data-copy-role="heading">{t.shellAuth}</h1>
      <p data-copy-role="body">{t.pageBody}</p>
      <form className="lf-gallery-form" noValidate onSubmit={(event) => event.preventDefault()}>
        <TextField label={t.identifier} autoComplete="username" />
        <TextField type="password" label={s.passphrase} revealLabels={{ show: s.show, hide: s.hide }} autoComplete="current-password" />
        <Button variant="accent" type="submit">{t.login}</Button>
      </form>
      {back}
    </AuthShell>;
  }

  const hue = (new URLSearchParams(location.search).get('hue') ?? 'primary') as SingleStateHue;
  return <SingleStateScreen {...common} pageTitle={t.singleHeading} hue={hue} labels={{ skip: t.skip }}
    bar={<IconButton glyph="close" label={s.close} variant="inverse" onClick={onGallery} />}
    actions={<Button variant={hue === 'accent' ? 'inverse' : 'accent'} size="lg">{s.continue}</Button>}>
    <h1 data-copy-role="heading">{t.singleHeading}</h1>
    <p data-copy-role="body">{t.singleBody}</p>
  </SingleStateScreen>;
}

function Page({ title, titleRole = 'heading', t, action, children }: { title: string; titleRole?: 'heading' | 'data'; t: GalleryCopy; action: ReactNode; children?: ReactNode }) {
  return <>
    <h1 data-copy-role={titleRole}>{title}</h1>
    <p data-copy-role="body">{t.pageBody}</p>
    {children}
    <Filler t={t} />
    <div>{action}</div>
  </>;
}

function Filler({ t }: { t: GalleryCopy }) {
  return <div className="lf-gallery-filler">
    <Card heading={t.moreGoals}>
      <List label={t.moreGoals}>
        {[t.goalBike, t.goalBook, t.goalGift, t.goalGame].map((goal) => <ListRow key={goal} title={goal} supporting={t.goalLeft} />)}
      </List>
    </Card>
    <Card heading={t.moreGoals}>
      <List label={t.moreGoals}>
        {[t.goalGame, t.goalGift, t.goalBook, t.goalBike].map((goal) => <ListRow key={goal} title={goal} supporting={t.goalLeft} />)}
      </List>
    </Card>
  </div>;
}

/** The gallery's index: one link per catalogue and per shell state, for audits and owner review. */
export function GalleryIndex({ t, onOpen }: { t: GalleryCopy; onOpen: (screen: string, shell?: ShellKind, extra?: Record<string, string>) => void }) {
  const shells: [ShellKind, string, Record<string, string>?][] = [
    ['learner', t.shellLearner], ['teen', t.shellTeen], ['tutor', t.shellTutor], ['staff', t.shellStaff], ['staff-limited', t.shellStaffLimited],
    ['site', t.shellSite], ['auth', t.shellAuth], ['single', t.shellSingle], ['table', t.shellTable],
  ];
  return <main className="lf-preview lf-preview--gallery" data-surface="app" data-screen="gallery">
    <div className="lf-preview-content lf-gallery">
      <h1 data-copy-role="heading">{t.title}</h1>
      <p data-copy-role="body">{t.indexBody}</p>
      <List label={t.title}>
        <ListRow title={t.controls} onPress={() => onOpen('system')} />
        <ListRow title={t.overlays} onPress={() => onOpen('overlays')} />
        {shells.map(([kind, label, extra]) => <ListRow key={kind} title={label} onPress={() => onOpen('shell', kind, extra)} />)}
      </List>
    </div>
  </main>;
}
