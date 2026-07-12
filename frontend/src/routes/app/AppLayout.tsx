import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { LOCALES, type Locale } from '@/i18n';
import { Badge, Button, Dropdown, Icon, ThemeToggle, type DropdownOption } from '@/components/ui';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isUnlocked, type NavItem } from './navConfig';

/*
 * App shell — /DESIGN.md §Screen Recipes → Dashboard: 280px fixed gamified
 * sidebar on desktop, frosted bottom tabs on mobile, white canvas content.
 * Everything renders from navConfig; role-locked items show as locked, never
 * hidden (locked-but-visible sells the upgrade path).
 */

const LOCALE_FLAGS: Record<Locale, string> = {
  'en-US': '🇺🇸',
  'es-MX': '🇲🇽',
  'pt-BR': '🇧🇷',
};

function initialsOf(name: string, email: string): string {
  const source = name.trim() || email;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function SidebarItem({ item, roles }: { item: NavItem; roles: string[] }) {
  const { t } = useTranslation();
  const unlocked = isUnlocked(item, roles);

  if (!unlocked) {
    return (
      <div
        aria-disabled="true"
        title={t('dashboard.nav.lockedHint')}
        className="flex min-h-12 items-center gap-3 rounded-full px-4 text-content-faint"
      >
        <Icon name={item.icon} />
        <span className="lf-label flex-1">{t(`dashboard.nav.${item.key}`)}</span>
        <span className="flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5">
          <Icon name="lock" className="!text-[14px]" />
          <span className="lf-caption font-bold">{t('dashboard.nav.lockedBadge')}</span>
        </span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          'motion-safe-press flex min-h-12 items-center gap-3 rounded-full px-4 transition-colors duration-150 active:translate-y-px',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isActive
            ? 'bg-primary-soft font-bold text-primary'
            : 'text-content-muted hover:bg-surface-sunken hover:text-content',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} fill={isActive} />
          <span className="lf-label">{t(`dashboard.nav.${item.key}`)}</span>
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
  const { session, profile, roles, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const email = session?.user.email ?? '';
  const displayName = profile?.display_name || email.split('@')[0] || '';
  const isParent = roles.includes('parent');

  const localeOptions: DropdownOption<Locale>[] = LOCALES.map((l) => ({
    value: l,
    label: t(`language.${l}`),
    prefix: <span aria-hidden="true">{LOCALE_FLAGS[l]}</span>,
  }));

  async function onLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-base text-content">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-outline/60 bg-surface px-4 py-6 lg:flex">
        <NavLink to="/learn" className="mb-8 flex items-center rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <img src="/logo-main-trimmed.png" alt={t('app.name')} className="h-9 w-auto" />
        </NavLink>

        <nav aria-label={t('dashboard.navLabel')} className="flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => (
            <SidebarItem key={item.key} item={item} roles={roles} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          {!isParent && (
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

          <div className="flex items-center justify-between gap-2 px-1">
            <Dropdown
              compact
              value={(i18n.resolvedLanguage as Locale) ?? 'en-US'}
              options={localeOptions}
              onChange={(l) => void i18n.changeLanguage(l)}
              ariaLabel={t('language.label')}
            />
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-surface-sunken p-3">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-on-primary">
              {initialsOf(displayName, email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="lf-label truncate text-content">{displayName}</p>
              {isParent && <Badge className="mt-0.5 bg-success-soft text-success-strong">{t('dashboard.tutorBadge')}</Badge>}
            </div>
            <button
              type="button"
              aria-label={t('dashboard.logout')}
              onClick={() => void onLogout()}
              className="flex h-10 w-10 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:bg-outline/50 hover:text-error-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          <Dropdown
            compact
            value={(i18n.resolvedLanguage as Locale) ?? 'en-US'}
            options={localeOptions}
            onChange={(l) => void i18n.changeLanguage(l)}
            ariaLabel={t('language.label')}
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
      <main key={location.pathname} className="lf-page-enter px-5 pb-24 pt-6 md:px-8 lg:ml-sidebar lg:pb-10 lg:pt-10">
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
