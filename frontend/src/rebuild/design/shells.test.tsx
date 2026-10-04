import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthShell, CONSOLE_TAB_LIMIT, DashboardLayout, DataTable, LearnerShell, permittedStaffItems, RebuildProvider, SingleStateScreen, SiteShell, STAFF_PERMISSIONS,
  StaffShell, TutorShell, type ShellNavItem, type StaffNavItem,
} from './controls';

/*
 * S03.2 shared shells at the component boundary (Frontend Bible 02 §1.1,
 * §4.5, §7 rule 9, §9.7, §9.8; 03 §3.4). The real-Chrome matrix repeats the
 * layout, focus and title checks with real input at 320–1280 px.
 */

const environment = { theme: 'light' as const, locale: 'pt-BR' as const };
const wrap = (node: React.ReactNode, theme: 'light' | 'dark' = 'light') =>
  <RebuildProvider environment={{ ...environment, theme }} labels={{ dismiss: 'Fechar aviso' }}>{node}</RebuildProvider>;
const labels = { skip: 'Ir para o conteúdo', navigation: 'Principal' };
const items: ShellNavItem[] = [
  { id: 'learn', label: 'Aprender', href: '?page=learn' },
  { id: 'tasks', label: 'Tarefas', href: '?page=tasks' },
  { id: 'wallet', label: 'Carteira', href: '?page=wallet' },
  { id: 'profile', label: 'Perfil', href: '?page=profile' },
];

/** Every visible string sits inside an element that declares its copy role (02 rule 19). */
function expectCopyRoles(root: ParentNode) {
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim() || node.parentElement?.closest('[hidden]')) continue;
    expect(node.parentElement!.closest('[data-copy-role]'), `"${node.textContent}" has no copy role`).not.toBeNull();
  }
}

let scrollTo: ReturnType<typeof vi.fn>;
beforeEach(() => {
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  document.title = '';
});
afterEach(() => cleanup());

function Learner({ page, character = 'dina', theme = 'light', onNavigate }: {
  page: string; character?: 'dina' | 'zara' | 'rho' | null; theme?: 'light' | 'dark'; onNavigate?: (href: string) => void;
}) {
  return wrap(<LearnerShell appName="LittleFounders" pageTitle={page === 'mentor' ? 'Dina' : 'Aprender'} routeKey={page} locale="pt-BR" labels={labels}
    items={items} current={page} mentor={{ href: '?page=mentor', name: 'Mentor', character }}
    onNavigate={onNavigate}>
    <h1 data-copy-role="heading">{page}</h1>
    <button type="button" data-copy-role="action">Dentro</button>
  </LearnerShell>, theme);
}

describe('frame: skip link, main, title, language and route focus', () => {
  it('starts with a skip link to the one <main>, and sets the title and language', () => {
    render(<Learner page="learn" />);
    const main = screen.getByRole('main');
    expect(document.querySelectorAll('main')).toHaveLength(1);
    const skip = screen.getByRole('link', { name: 'Ir para o conteúdo' });
    expect(document.querySelector('.lf-shell a')).toBe(skip);
    expect(skip.getAttribute('href')).toBe(`#${main.id}`);
    fireEvent.click(skip);
    expect(document.activeElement).toBe(main);
    expect(document.title).toBe('Aprender · LittleFounders');
    expect(document.documentElement.lang).toBe('pt-BR');
    expect(document.querySelector('.lf-shell')).toHaveAttribute('lang', 'pt-BR');
  });

  it('does not treat the first load as a route change, even when StrictMode runs the effects twice (W2 real routes)', () => {
    render(<StrictMode><Learner page="learn" /></StrictMode>);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it('on a route change scrolls to the top and focuses the new heading; a re-render of the same route does neither', () => {
    const { rerender } = render(<Learner page="learn" />);
    expect(scrollTo).not.toHaveBeenCalled();
    const inside = screen.getByRole('button', { name: 'Dentro' });
    inside.focus();
    rerender(<Learner page="learn" theme="light" />);
    expect(document.activeElement).toBe(inside);
    expect(scrollTo).not.toHaveBeenCalled();
    rerender(<Learner page="wallet" />);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(document.activeElement).toBe(heading);
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('plays the shell route entrance on <main> only on a real route change (02 rule 14), and clears it when it ends', () => {
    const { rerender } = render(<StrictMode><Learner page="learn" /></StrictMode>);
    const main = screen.getByRole('main');
    expect(main).not.toHaveAttribute('data-route-enter');
    rerender(<StrictMode><Learner page="learn" theme="light" /></StrictMode>);
    expect(main).not.toHaveAttribute('data-route-enter');
    rerender(<StrictMode><Learner page="wallet" /></StrictMode>);
    expect(main).toHaveAttribute('data-route-enter');
    fireEvent.animationEnd(main);
    expect(main).not.toHaveAttribute('data-route-enter');
    // No legacy page body and no legacy entrance class are left in the shell (02 rule 23).
    expect(document.querySelector('[data-legacy-body], .lf-page-enter')).toBeNull();
  });

  it('navigates client-side on a plain click only, and marks the current page', () => {
    const onNavigate = vi.fn();
    render(<Learner page="learn" onNavigate={onNavigate} />);
    const [tabs] = screen.getAllByRole('navigation', { name: 'Principal' }).filter((nav) => nav.classList.contains('lf-tabbar'));
    const wallet = within(tabs!).getByRole('link', { name: 'Carteira' });
    expect(within(tabs!).getByRole('link', { name: 'Aprender' })).toHaveAttribute('aria-current', 'page');
    expect(wallet).not.toHaveAttribute('aria-current');
    fireEvent.click(wallet);
    expect(onNavigate).toHaveBeenCalledWith('?page=wallet');
    // A modified click is the browser's (a new tab); jsdom cannot navigate, so the test stops it after the shell has declined it.
    const stop = (event: MouseEvent) => event.preventDefault();
    document.addEventListener('click', stop);
    fireEvent.click(wallet, { ctrlKey: true });
    document.removeEventListener('click', stop);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

describe('learner shell', () => {
  it('shows the chosen Mentor’s name and a real-model render in the tab, second in order', () => {
    render(<Learner page="mentor" />);
    const tabs = document.querySelector('.lf-tabbar')!;
    const links = [...tabs.querySelectorAll('a')];
    expect(links.map((link) => link.textContent)).toEqual(['Aprender', 'Dina', 'Tarefas', 'Carteira', 'Perfil']);
    const mentor = links[1]!;
    expect(mentor).toHaveAttribute('aria-current', 'page');
    expect(mentor.querySelector('[data-copy-role="data"]')?.textContent).toBe('Dina');
    const avatar = mentor.querySelector('[data-slot="mentor-avatar"] img')!;
    expect(avatar.getAttribute('data-character')).toBe('dina');
    expect(avatar.getAttribute('src')).toBe('/rebuild/mentor-avatars/dina-light.png');
    expect(avatar.getAttribute('data-pose')).toBe('ambient.idle');
    expect(document.querySelector('.lf-tabbar')).toHaveAttribute('data-dock');
  });

  it('uses the dark render in dark mode', () => {
    render(<Learner page="learn" theme="dark" />);
    expect(document.querySelector('.lf-tabbar [data-slot="mentor-avatar"] img')?.getAttribute('src')).toBe('/rebuild/mentor-avatars/dina-dark.png');
  });

  it('shows each chosen character in its own render, and an unchosen Mentor as words only (never a stand-in)', () => {
    render(<Learner page="learn" character="zara" />);
    const zara = [...document.querySelectorAll('.lf-tabbar a')].find((link) => link.textContent === 'Zara')!;
    expect(zara.querySelector('[data-slot="mentor-avatar"] img')).toHaveAttribute('src', '/rebuild/mentor-avatars/zara-light.png');
    expect(zara.querySelector('svg')).toBeNull();
    cleanup();
    render(<Learner page="learn" character={null} />);
    const mentor = [...document.querySelectorAll('.lf-tabbar a')].find((link) => link.textContent === 'Mentor')!;
    expect(mentor.querySelector('img, svg, [data-slot]')).toBeNull();
    expect(mentor.querySelector('[data-copy-role="action"]')).not.toBeNull();
  });

  it('names the tab from the chosen character itself, so the name can never disagree with the picture (OD-6)', () => {
    render(<Learner page="learn" character="rho" />);
    const rho = [...document.querySelectorAll('.lf-tabbar a')].find((link) => link.textContent === 'Dr. Rho')!;
    expect(rho.querySelector('[data-slot="mentor-avatar"] img')).toHaveAttribute('data-character', 'rho');
    cleanup();
    render(wrap(<LearnerShell appName="LittleFounders" pageTitle="Aprender" routeKey="learn" locale="pt-BR" labels={labels} current="learn"
      items={items} mentor={{ href: '?page=mentor', name: 'Tutor IA', character: 'zara' }}><h1>Aprender</h1></LearnerShell>));
    const labelsShown = [...document.querySelectorAll('.lf-tabbar a')].map((link) => link.textContent);
    expect(labelsShown).toContain('Zara');
    expect(labelsShown).not.toContain('Tutor IA');
  });

  it('age changes content, never components: a teen without a parent simply has no Tasks item (OD-3, D8)', () => {
    render(wrap(<LearnerShell appName="LittleFounders" pageTitle="Aprender" routeKey="learn" locale="pt-BR" labels={labels} current="learn"
      items={items.filter((item) => item.id !== 'tasks')} mentor={{ href: '?page=mentor', name: 'Zara', character: 'zara' }}><h1>Aprender</h1></LearnerShell>));
    expect([...document.querySelectorAll('.lf-tabbar a')].map((link) => link.textContent)).toEqual(['Aprender', 'Zara', 'Carteira', 'Perfil']);
    expect(document.querySelector('.lf-shell--learner')).not.toBeNull();
  });

  it('declares a copy role for every string', () => {
    render(<Learner page="learn" />);
    expectCopyRoles(document.querySelector('.lf-shell')!);
  });
});

/*
 * 02 §7 rule 9 at a 320 px container. jsdom has no container queries, so the test applies the shell sheet's own
 * `@container app (max-width: 359px)` block (read from shells.css, not copied) as a plain stylesheet: exactly
 * what a 320 px `app` container turns on. The real-Chrome audit (audit:text-fit at 320 px) measures the layout.
 */
function compactRules() {
  const css = readFileSync(resolve(__dirname, 'shells.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const start = css.indexOf('@container app (max-width: 359px)');
  expect(start).toBeGreaterThan(-1);
  let depth = 0, cursor = css.indexOf('{', start);
  const open = cursor;
  for (; cursor < css.length; cursor++) {
    if (css[cursor] === '{') depth++;
    if (css[cursor] === '}' && --depth === 0) break;
  }
  // `:has()` (the bar's insets) is left out: jsdom's selector engine does not evaluate it, and it changes no visibility.
  // The `.lf-rebuild` scope is the app's root (ShellRoot), which a component render has no need of.
  return css.slice(open + 1, cursor).split('}').filter((rule) => rule.trim() && !rule.includes(':has('))
    .map((rule) => `${rule.replace(/\.lf-rebuild\s+/g, '')}}`).join(' ');
}
function atCompactContainer() {
  const style = document.createElement('style');
  style.textContent = compactRules();
  document.head.append(style);
  return () => style.remove();
}
const labelShown = (link: Element) => getComputedStyle(link.querySelector('.lf-nav-label')!).clipPath !== 'inset(50%)';
const marked: ShellNavItem[] = [
  { id: 'learn', label: 'Aprender', href: '?page=learn', iconAssetId: 'nav.icon.learn' },
  { id: 'tasks', label: 'Tarefas', href: '?page=tasks', iconAssetId: 'nav.icon.tasks' },
  { id: 'wallet', label: 'Carteira', href: '?page=wallet', iconAssetId: 'nav.icon.wallet' },
  { id: 'profile', label: 'Perfil', href: '?page=profile', iconAssetId: 'nav.icon.profile' },
];

describe('compact tab bar at a 320 px container (02 §7 rule 9)', () => {
  let restore: () => void = () => undefined;
  beforeEach(() => { restore = atCompactContainer(); });
  afterEach(() => restore());

  it('every tab has its own mark, so only the current tab shows its label; every name stays in the accessibility tree', () => {
    render(wrap(<LearnerShell appName="LittleFounders" pageTitle="Tarefas" routeKey="tasks" locale="pt-BR" labels={labels} current="tasks"
      items={marked} mentor={{ href: '?page=mentor', name: 'Mentor', character: 'dina' }}><h1 data-copy-role="heading">Tarefas</h1></LearnerShell>));
    const bar = document.querySelector('.lf-tabbar .lf-nav-list--tab')!;
    expect(bar).toHaveAttribute('data-icons', 'all');
    const links = [...bar.querySelectorAll('a')];
    expect(links.map((link) => link.querySelector('img')?.getAttribute('src'))).toEqual([
      '/rebuild/art/nav-learn.svg', '/rebuild/mentor-avatars/dina-light.png', '/rebuild/art/nav-tasks.svg', '/rebuild/art/nav-wallet.svg', '/rebuild/art/nav-profile.svg']);
    expect(links.filter(labelShown).map((link) => link.textContent)).toEqual(['Tarefas']);
    const tabbar = within(document.querySelector('.lf-tabbar') as HTMLElement);
    for (const name of ['Aprender', 'Dina', 'Tarefas', 'Carteira', 'Perfil']) expect(tabbar.getByRole('link', { name })).toBeInTheDocument();
    // The marks are decorative: the word is the name, never the picture (07 §8).
    for (const image of bar.querySelectorAll('img.lf-nav-icon')) { expect(image).toHaveAttribute('alt', ''); expect(image).toHaveAttribute('aria-hidden', 'true'); }
  });

  it('the Mentor tab before a character is chosen has no stand-in picture and keeps its word (02 rule 21)', () => {
    render(wrap(<LearnerShell appName="LittleFounders" pageTitle="Aprender" routeKey="learn" locale="pt-BR" labels={labels} current="learn"
      items={marked} mentor={{ href: '?page=mentor', name: 'Mentor', character: null }}><h1 data-copy-role="heading">Aprender</h1></LearnerShell>));
    const bar = document.querySelector('.lf-tabbar .lf-nav-list--tab')!;
    expect(bar).toHaveAttribute('data-icons', 'all');
    const links = [...bar.querySelectorAll('a')];
    expect(links.filter(labelShown).map((link) => link.textContent)).toEqual(['Aprender', 'Mentor']);
    expect(links[1]!.querySelector('img, svg, [data-slot]')).toBeNull();
  });

  it('a tab without a registered mark keeps every label visible (the labels wrap instead)', () => {
    render(wrap(<LearnerShell appName="LittleFounders" pageTitle="Aprender" routeKey="learn" locale="pt-BR" labels={labels} current="learn"
      items={[...marked.slice(0, 3), { ...marked[3]!, iconAssetId: 'nav.icon.missing' }]} mentor={{ href: '?page=mentor', name: 'Mentor', character: 'zara' }}>
      <h1 data-copy-role="heading">Aprender</h1></LearnerShell>));
    const bar = document.querySelector('.lf-tabbar .lf-nav-list--tab')!;
    expect(bar).toHaveAttribute('data-icons', 'partial');
    expect([...bar.querySelectorAll('a')].every(labelShown)).toBe(true);
  });

  it('the Tutor console tab bar compacts the same way', () => {
    const tutorItems: ShellNavItem[] = [
      { id: 'family', label: 'Família', href: '?page=family', iconAssetId: 'nav.icon.family' },
      { id: 'tasks', label: 'Tarefas', href: '?page=tasks', iconAssetId: 'nav.icon.tasks' },
      { id: 'banking', label: 'Moedas', href: '?page=banking', iconAssetId: 'nav.icon.coins' },
      { id: 'learn', label: 'Aprender', href: '?page=learn', iconAssetId: 'nav.icon.learn' },
      { id: 'profile', label: 'Perfil', href: '?page=profile', iconAssetId: 'nav.icon.profile' },
    ];
    render(wrap(<TutorShell appName="LittleFounders" pageTitle="Família" routeKey="family" locale="pt-BR" labels={{ ...labels, menu: 'Menu', close: 'Fechar' }}
      roleLabel="Tutor" current="family" items={tutorItems}><h1 data-copy-role="heading">Família</h1></TutorShell>));
    const bar = document.querySelector('.lf-tabbar .lf-nav-list--tab')!;
    expect(bar).toHaveAttribute('data-icons', 'all');
    expect([...bar.querySelectorAll('a')].filter(labelShown).map((link) => link.textContent)).toEqual(['Família']);
  });
});

describe('console shells', () => {
  const consoleLabels = { ...labels, menu: 'Menu', close: 'Fechar' };
  it('the Tutor console names the verified parent and uses the tab bar for up to five destinations', () => {
    render(wrap(<TutorShell appName="LittleFounders" pageTitle="Família" routeKey="family" locale="pt-BR" labels={consoleLabels} roleLabel="Tutor"
      current="family" items={items.slice(0, 4)}><h1 data-copy-role="heading">Família</h1></TutorShell>));
    expect(document.querySelector('[data-shell="tutor"]')).not.toBeNull();
    expect(screen.getAllByText('Tutor').length).toBeGreaterThan(0);
    expect(document.querySelector('.lf-tabbar')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    expectCopyRoles(document.querySelector('.lf-shell')!);
  });

  const staffItems: StaffNavItem[] = [
    { id: 'overview', label: 'Visão geral', href: '?page=overview' },
    { id: 'users', label: 'Usuários', href: '?page=users', permission: 'manage_users' },
    { id: 'content', label: 'Conteúdo', href: '?page=content', permission: 'manage_content' },
    { id: 'insights', label: 'Métricas', href: '?page=insights', permission: 'view_analytics' },
    { id: 'reports', label: 'Denúncias', href: '?page=reports', permission: 'manage_support' },
    { id: 'audit', label: 'Registro de auditoria', href: '?page=audit', permission: ['manage_support', 'manage_users'] },
  ];

  it('staff navigation shows only what the grants open; superadmins see everything', () => {
    const ids = (grants: Parameters<typeof permittedStaffItems>[1]) => permittedStaffItems(staffItems, grants).map((item) => item.id);
    expect(ids({ superadmin: true, permissions: [] })).toEqual(['overview', 'users', 'content', 'insights', 'reports', 'audit']);
    expect(ids({ superadmin: false, permissions: [] })).toEqual(['overview']);
    expect(ids({ superadmin: false, permissions: ['view_analytics'] })).toEqual(['overview', 'insights']);
    expect(ids({ superadmin: false, permissions: ['manage_users'] })).toEqual(['overview', 'users', 'audit']);
  });

  it('more than five destinations move into a named menu sheet on phones; the rail always lists them', () => {
    render(wrap(<StaffShell appName="LittleFounders" pageTitle="Visão geral" routeKey="overview" locale="pt-BR" labels={consoleLabels} roleLabel="Equipe"
      current="overview" items={staffItems} grants={{ superadmin: true, permissions: [] }}><h1>{'Visão geral'}</h1></StaffShell>));
    expect(staffItems.length).toBeGreaterThan(CONSOLE_TAB_LIMIT);
    expect(document.querySelector('.lf-tabbar > .lf-icon-button')).not.toBeNull();
    expect(document.querySelector('.lf-appbar')).toBeNull();
    expect(document.querySelectorAll('.lf-shell-rail a')).toHaveLength(6);
    const menu = screen.getByRole('button', { name: 'Menu' });
    // No focus() first: Safari does not focus a button on click, so focus must come back to the control that was pressed anyway.
    fireEvent.pointerDown(menu);
    fireEvent.click(menu);
    const sheet = screen.getByRole('dialog', { name: 'Principal' });
    expect(within(sheet).getAllByRole('link').map((link) => link.textContent)).toEqual(staffItems.map((item) => item.label));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(menu);
  });

  it('a staff member without a grant never sees the destination', () => {
    render(wrap(<StaffShell appName="LittleFounders" pageTitle="Visão geral" routeKey="overview" locale="pt-BR" labels={consoleLabels} roleLabel="Equipe"
      current="overview" items={staffItems} grants={{ superadmin: false, permissions: ['view_analytics'] }}><h1>{'Visão geral'}</h1></StaffShell>));
    expect([...document.querySelectorAll('.lf-shell-rail a')].map((link) => link.textContent)).toEqual(['Visão geral', 'Métricas']);
    expect(screen.queryByText('Usuários')).toBeNull();
  });

  it('mirrors Core’s staff permission list exactly (no shared types across packages, so the copies are pinned)', () => {
    const auth = readFileSync(resolve(process.cwd(), '../backend/src/middleware/auth.ts'), 'utf8');
    const union = auth.match(/requireAdminPermission\(permission: ([^)]+)\)/)?.[1] ?? '';
    expect([...union.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort()).toEqual([...STAFF_PERMISSIONS].sort());
  });
});

describe('public site and sign-in', () => {
  const siteLabels = { ...labels, menu: 'Menu', close: 'Fechar' };
  it('the site header keeps one accent call to action and opens a full menu sheet', () => {
    render(wrap(<SiteShell appName="LittleFounders" pageTitle="" routeKey="home" locale="pt-BR" labels={siteLabels} homeHref="?page=home"
      links={[{ id: 'how', label: 'Como funciona', href: '?page=how' }]} secondaryAction={{ label: 'Entrar', href: '?page=login' }}
      primaryAction={{ label: 'Comece grátis', href: '?page=start' }} stickyAction={{ label: 'Comece grátis', href: '?page=start' }}>
      <h1 data-copy-role="heading">Finanças para toda a família</h1></SiteShell>));
    expect(document.title).toBe('LittleFounders');
    const header = document.querySelector('.lf-site-header')!;
    expect(header.querySelectorAll('.lf-button--accent')).toHaveLength(1);
    expect(document.querySelector('.lf-sticky-action')).toHaveAttribute('data-visible', 'false');
    expect(document.querySelector('.lf-sticky-action')).not.toHaveAttribute('data-dock');
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Principal' });
    expect(sheet).toHaveClass('lf-sheet--full');
    expect(within(sheet).getByRole('link', { name: 'Como funciona' })).toBeInTheDocument();
    expectCopyRoles(document.body);
  });

  it('the sign-in shell has the brand, one way back and one column', () => {
    render(wrap(<AuthShell appName="LittleFounders" pageTitle="Entrar" routeKey="login" locale="pt-BR" labels={{ skip: labels.skip }} homeHref="?page=home"
      back={{ label: 'Voltar', href: '?page=home' }}><h1>Entrar</h1></AuthShell>));
    expect(document.title).toBe('Entrar · LittleFounders');
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveClass('lf-button');
    expect(document.querySelector('.lf-auth-column h1')).not.toBeNull();
  });
});

describe('single-state screen and table', () => {
  it('fills the screen with one hue and docks the actions', () => {
    render(wrap(<SingleStateScreen appName="LittleFounders" pageTitle="Escolha um bolso" routeKey="pick" locale="pt-BR" hue="accent" labels={{ skip: labels.skip }}
      actions={<button type="button">Continuar</button>}><h1>Escolha um bolso</h1></SingleStateScreen>));
    const shell = document.querySelector('[data-shell="single-state"]')!;
    expect(shell).toHaveClass('lf-single-state--accent');
    expect(shell.querySelector('.lf-single-state-actions')).toHaveAttribute('data-dock');
  });

  it('a dashboard page keeps the main task first in source order', () => {
    render(<DashboardLayout primary={<p data-copy-role="body">Tarefas</p>} secondary={<p data-copy-role="body">Dicas</p>} />);
    expect([...document.querySelectorAll('.lf-dashboard-grid > div')].map((column) => column.className)).toEqual(['lf-dashboard-primary', 'lf-dashboard-secondary']);
    expect(document.querySelector('.lf-dashboard-grid')).toHaveClass('lf-dashboard-grid--split');
  });

  it('a dashboard page without a supporting column keeps the main task at full width', () => {
    render(<DashboardLayout primary={<p data-copy-role="body">Tarefas</p>} />);
    expect(document.querySelector('.lf-dashboard-grid')).not.toHaveClass('lf-dashboard-grid--split');
    expect(document.querySelectorAll('.lf-dashboard-grid > div')).toHaveLength(1);
  });

  it('keeps table semantics and a visible label for every cell, and wraps user names anywhere', () => {
    render(<DataTable caption="Membros da família" rowKey={(row) => row.name}
      rows={[{ name: 'Alessandro_Bartolomeo_Villanueva_Rodriguez_2014', role: 'Estudante' }]}
      columns={[{ key: 'name', label: 'Nome', value: (row) => row.name, ugc: true }, { key: 'role', label: 'Papel', value: (row) => row.role }]} />);
    const table = screen.getByRole('table', { name: 'Membros da família' });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Nome', 'Papel']);
    const cells = within(table).getAllByRole('cell');
    expect(cells[0]!.querySelector('.lf-table-label')?.textContent).toBe('Nome');
    expect(cells[0]!.querySelector('.lf-table-label')).toHaveAttribute('aria-hidden', 'true');
    expect(cells[0]!.querySelector('.lf-table-value')).toHaveClass('ugc');
    expectCopyRoles(table);
  });
});
