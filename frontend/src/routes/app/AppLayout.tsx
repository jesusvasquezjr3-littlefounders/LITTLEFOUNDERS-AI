import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Button, Icon, ThemeToggle } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isUnlocked, type NavItem } from './navConfig';

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
  const unlocked = isUnlocked(item, roles);
  const label = t(`dashboard.nav.${item.key}`);

  if (!unlocked) {
    return (
      <div
        aria-disabled="true"
        title={t('dashboard.nav.lockedHint')}
        className={cn(
          'flex min-h-12 items-center gap-3 rounded-full text-content-faint',
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
            <span className="lf-label flex-1">{label}</span>
            <span className="flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5">
              <Icon name="lock" className="!text-[14px]" />
              <span className="lf-caption font-bold">{t('dashboard.nav.lockedBadge')}</span>
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'motion-safe-press flex min-h-12 items-center gap-3 rounded-full transition-colors duration-150 active:translate-y-px',
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
  const unlocked = isUnlocked(item, roles);

  if (!unlocked) {
    return (
      <div aria-disabled="true" className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-content-faint">
        <Icon name="lock" />
        <span className="lf-caption">{t(`dashboard.nav.${item.key}`)}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-md transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isActive ? 'text-primary' : 'text-content-muted',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} fill={isActive} />
          <span className={cn('lf-caption', isActive && 'font-bold')}>{t(`dashboard.nav.${item.key}`)}</span>
        </>
      )}
    </NavLink>
  );
}

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { session, profile, roles, avatarOptions, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');

  const email = session?.user.email ?? '';
  const displayName = profile?.display_name || email.split('@')[0] || '';
  const isParent = roles.includes('parent');
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

  async function onLogout() {
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
          className="absolute -right-3.5 top-7 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-outline bg-surface text-content-muted shadow-glass-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} className="!text-[18px]" />
        </button>

        <NavLink
          to="/learn"
          className={cn(
            'mb-8 flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            collapsed ? 'justify-center' : 'px-2',
          )}
        >
          {collapsed ? (
            <img src="/favicon.png" alt={t('app.name')} className="h-9 w-9" />
          ) : (
            <img src="/logo-main-trimmed.png" alt={t('app.name')} className="h-9 w-auto" />
          )}
        </NavLink>

        <nav aria-label={t('dashboard.navLabel')} className="flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => (
            <SidebarItem key={item.key} item={item} roles={roles} collapsed={collapsed} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          {!isParent && !collapsed && (
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
            <div className="flex items-center justify-end px-1">
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
