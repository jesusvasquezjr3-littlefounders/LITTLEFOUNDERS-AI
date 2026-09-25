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
  page: string; character?: 'dina' | 'zara' | null; theme?: 'light' | 'dark'; onNavigate?: (href: string) => void;
}) {
  return wrap(<LearnerShell appName="LittleFounders" pageTitle={page === 'mentor' ? 'Dina' : 'Aprender'} routeKey={page} locale="pt-BR" labels={labels}
    items={items} current={page} mentor={{ href: '?page=mentor', name: character ? character[0]!.toUpperCase() + character.slice(1) : 'Mentor', character }}
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
    expect(document.querySelector('.lf-tabbar')).toBeNull();
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
