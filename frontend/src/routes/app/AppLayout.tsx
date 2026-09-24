import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@/i18n';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { playPlatformSound } from '@/lib/sound';
import { Badge, Button, Dropdown, Icon, LocaleFlag, ThemeToggle, type DropdownOption } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isUnlocked, type NavItem } from './navConfig';
import { visibleAdminSections } from '@/routes/admin/adminNav';

/*
 * App shell — /DESIGN.md §Screen Recipes → Dashboard. Desktop sidebar is
 * COLLAPSIBLE (288px ↔ 88px, minimal edge chevron, favicon as the collapsed
 * brand); language now lives in /profile/settings (a persistent DB field),
 * so the shell carries only the theme control. Role-locked items render
 * LOCKED, never hidden.
 */

const COLLAPSE_KEY = 'lf-sidebar-collapsed';

function SidebarItem({ item, roles, collapsed }: { item: NavItem; roles: string[]; collapsed: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const unlocked = isUnlocked(item, roles);
  const label = t(`dashboard.nav.${item.key}`);

  if (!unlocked) {
    // Locked items are a call to action, not a dead end (owner report,
    // 2026-09-09): tapping used to do nothing, and the explanation lived
    // ONLY in a hover title — invisible on mobile, which has no hover
    // (§1.11). It now routes straight to the same upgrade flow the sidebar's
    // own "Become a Tutor" panel already links to.
    return (
      <button
        type="button"
        title={t('dashboard.nav.lockedHint')}
        onClick={() => navigate('/verify-parent')}
        className={cn(
          'flex min-h-12 items-center gap-3 rounded-full text-content-faint transition-colors duration-150',
          'hover:bg-surface-sunken hover:text-content-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          collapsed ? 'justify-center px-0' : 'px-4',
        )}
      >
        <span className="relative flex items-center justify-center">
          <Icon name={item.icon} />
          {collapsed && (
            <Icon name="lock" className="absolute -bottom-1 -right-1 !text-[12px] text-content-muted" />
          )}
        </span>
        {!collapsed && (
          <>
            <span className="lf-label flex-1 text-left">{label}</span>
            <span className="flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5">
              <Icon name="lock" className="!text-[14px]" />
              <span className="lf-caption font-bold">{t('dashboard.nav.lockedBadge')}</span>
            </span>
          </>
        )}
      </button>
    );
  }

  return (
    <NavLink
      to={item.path}
      title={collapsed ? label : undefined}
      onClick={() => playPlatformSound('nav_tap')}
      className={({ isActive }) =>
        cn(
          'motion-safe-press flex min-h-12 items-center gap-3 rounded-full transition-colors duration-150 lf-press',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          collapsed ? 'justify-center px-0' : 'px-4',
          isActive
            ? 'bg-primary-soft font-bold text-primary'
            : 'text-content-muted hover:bg-surface-sunken hover:text-content',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} fill={isActive} />
          {!collapsed && <span className="lf-label">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

function MobileTab({ item, roles }: { item: NavItem; roles: string[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const unlocked = isUnlocked(item, roles);

  if (!unlocked) {
    // Same tap-to-explain fix as SidebarItem — mobile never had a hover
    // hint to fall back on, so a locked tab was a pure dead end (§1.11).
    return (
      <button
        type="button"
        onClick={() => navigate('/verify-parent')}
        className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-content-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name="lock" />
        <span className="lf-caption max-w-full text-center leading-tight">{t(`dashboard.nav.${item.key}`)}</span>
      </button>
    );
  }

  return (
    <NavLink
      to={item.path}
      onClick={() => playPlatformSound('nav_tap')}
      className={({ isActive }) =>
        cn(
          'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isActive ? 'text-primary' : 'text-content-muted',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} fill={isActive} />
          <span className={cn('lf-caption max-w-full text-center leading-tight', isActive && 'font-bold')}>{t(`dashboard.nav.${item.key}`)}</span>
        </>
      )}
    </NavLink>
  );
}

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { session, profile, roles, adminPermissions, avatarOptions, logout, getToken, refreshMe } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');

  const email = session?.user.email ?? '';
  const displayName = profile?.display_name || email.split('@')[0] || '';
  const isParent = roles.includes('parent');
  // Staff console entry — HIDDEN for non-staff, never locked (DESIGN.md
  // Screen Recipes → Console): admin is not an aspirational upgrade, so the
  // locked-chip grammar doesn't apply and the link simply doesn't exist.
  const isStaff = visibleAdminSections(roles, adminPermissions).length > 0;
  const userId = session?.user.id ?? 'littlefounder';

  // The DB locale is the user's language of record — the UI follows it.
  useEffect(() => {
    if (profile?.locale && profile.locale !== i18n.resolvedLanguage) {
      void i18n.changeLanguage(profile.locale);
    }
  }, [profile?.locale, i18n]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      return !c;
    });
  }

  const localeOptions: DropdownOption<Locale>[] = LOCALES.map((l) => ({
    value: l,
    label: t(`language.${l}`),
    prefix: <LocaleFlag locale={l} />,
  }));

  async function handleLanguageChange(l: Locale) {
    void i18n.changeLanguage(l);
    if (!session) return;
    const token = await getToken();
    await api('/profile', { method: 'PATCH', body: { locale: l }, token });
    await refreshMe();
  }

  async function onLogout() {
    playPlatformSound('auth_bye');
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-base text-content">
      {/* ── Desktop sidebar (collapsible) ───────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-outline/60 bg-surface py-6 transition-[width] duration-300 lg:flex',
          collapsed ? 'w-sidebar-sm px-3' : 'w-sidebar px-4',
        )}
      >
        <button
          type="button"
          aria-label={collapsed ? t('dashboard.sidebar.expand') : t('dashboard.sidebar.collapse')}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
          className="lf-press absolute -right-3.5 top-7 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-outline bg-surface text-content-muted shadow-glass-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} className="!text-[18px]" />
        </button>

        <NavLink
          to="/learn"
          className={cn(
            'mb-8 flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            collapsed ? 'justify-center' : 'px-2',
          )}
        >
          {collapsed ? (
            <img src="/favicon.png" alt={t('app.name')} className="h-9 w-9" />
          ) : (
            <img src="/logo-main-trimmed.png" alt={t('app.name')} className="h-9 w-auto" />
          )}
        </NavLink>

        <nav
          aria-label={t('dashboard.navLabel')}
          className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]"
        >
          {NAV_ITEMS.map((item) => (
            <SidebarItem key={item.key} item={item} roles={roles} collapsed={collapsed} />
          ))}
          {isStaff && (
            <div className="mt-2 flex flex-col gap-1.5">
              {collapsed ? (
                <div className="mx-3 my-1 border-t border-outline/50" />
              ) : (
                <p className="lf-caption px-4 pt-1 font-bold text-content-faint">{t('admin.sidebarGroup')}</p>
              )}
              {visibleAdminSections(roles, adminPermissions).map((s) => (
                <NavLink
                  key={s.key}
                  to={s.path}
                  end={s.path === '/admin'}
                  title={collapsed ? t(`admin.nav.${s.key}`) : undefined}
                  className={({ isActive }) =>
                    cn(
                      'motion-safe-press flex min-h-11 items-center gap-3 rounded-full transition-colors duration-150 lf-press',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      collapsed ? 'justify-center px-0' : 'px-4',
                      isActive ? 'bg-primary-soft font-bold text-primary' : 'text-content-muted hover:bg-surface-sunken hover:text-content',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon name={s.icon} fill={isActive} className="!text-[20px]" />
                      {!collapsed && <span className="lf-label">{t(`admin.nav.${s.key}`)}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="mt-4 flex shrink-0 flex-col gap-4 pt-4">
          {!isParent && !isStaff && !collapsed && (
            <div className="rounded-lg bg-accent-soft/60 p-4">
              <div className="flex items-center gap-2 text-content">
                <Icon name="family_restroom" className="text-accent-strong" />
                <p className="lf-label">{t('dashboard.upgrade.title')}</p>
              </div>
              <p className="lf-caption mt-1.5 text-content-muted">{t('dashboard.upgrade.body')}</p>
              <Button className="mt-3 w-full px-4 py-2" onClick={() => navigate('/verify-parent')}>
                {t('dashboard.upgrade.cta')}
              </Button>
            </div>
          )}

          {!collapsed && (
            <div className="flex items-center justify-between px-1">
              <Dropdown
                compact
                placement="top"
                align="left"
                value={(i18n.resolvedLanguage as Locale) ?? 'en-US'}
                options={localeOptions}
                onChange={(l) => void handleLanguageChange(l)}
                ariaLabel={t('language.label') ?? 'Language'}
              />
              <ThemeToggle />
            </div>
          )}

          <div
            className={cn(
              'flex items-center gap-3 rounded-lg bg-surface-sunken',
              collapsed ? 'flex-col p-2' : 'p-3',
            )}
          >
            <NavLink
              to="/profile"
              title={t('dashboard.nav.profile')}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Avatar options={avatarOptions} seed={userId} className="h-10 w-10" />
            </NavLink>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="lf-label truncate text-content">{displayName}</p>
                {profile?.username ? (
                  <p className="lf-caption truncate text-content-muted">@{profile.username}</p>
                ) : (
                  isParent && <Badge className="mt-0.5 bg-success-soft text-success-strong">{t('dashboard.tutorBadge')}</Badge>
                )}
              </div>
            )}
            <button
              type="button"
              aria-label={t('dashboard.logout')}
              onClick={() => void onLogout()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:bg-outline/50 hover:text-error-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────── */}
      <header className="lf-glass sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-x-0 border-t-0 px-4 lg:hidden">
        <NavLink to="/learn" className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <img src="/logo-main-trimmed.png" alt={t('app.name')} className="h-8 w-auto" />
        </NavLink>
        <div className="flex items-center gap-2">
          {isStaff && (
            <NavLink
              to="/admin"
              aria-label={t('admin.sidebarGroup')}
              className={({ isActive }) =>
                cn(
                  'flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive ? 'bg-primary-soft text-primary' : 'text-content-muted hover:text-primary',
                )
              }
            >
              {({ isActive }) => <Icon name="shield_person" fill={isActive} />}
            </NavLink>
          )}
          <Dropdown
            compact
            value={(i18n.resolvedLanguage as Locale) ?? 'en-US'}
            options={localeOptions}
            onChange={(l) => void handleLanguageChange(l)}
            ariaLabel={t('language.label') ?? 'Language'}
          />
          <ThemeToggle />
          <button
            type="button"
            aria-label={t('dashboard.logout')}
            onClick={() => void onLogout()}
            className="flex h-11 w-11 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:text-error-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="logout" />
          </button>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────── */}
      <main
        key={location.pathname}
        className={cn(
          'lf-page-enter px-5 pb-24 pt-6 transition-[margin] duration-300 md:px-8 lg:pb-10 lg:pt-10',
          collapsed ? 'lg:ml-sidebar-sm' : 'lg:ml-sidebar',
        )}
      >
        <div className="mx-auto max-w-container">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile bottom tabs ──────────────────────────── */}
      <nav
        aria-label={t('dashboard.navLabel')}
        className="lf-glass fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-x-0 border-b-0 px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <MobileTab key={item.key} item={item} roles={roles} />
        ))}
      </nav>
    </div>
  );
}
