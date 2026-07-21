import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Avatar } from '@/components/Avatar';
import { Icon, ThemeToggle } from '@/components/ui';
import { cn } from '@/lib/utils';

/*
 * Staff console shell — /DESIGN.md §Screen Recipes → Console. The ONE
 * surface that is HIDDEN, not locked: routing never renders it for
 * non-staff (RequireRole redirects), and no navConfig entry exists — the
 * locked-chip grammar is for aspirational upgrades, which admin is not.
 * Same token system as the app, quieter voice: no upsell cards, no
 * characters, papaya only for true CTAs.
 */

const SECTIONS = [{ key: 'analytics', path: '/admin' }] as const;

export function ConsoleLayout() {
  const { t } = useTranslation();
  const { session, avatarOptions } = useAuth();
  const userId = session?.user.id ?? 'staff';

  return (
    <div className="min-h-screen bg-base text-content">
      <header className="lf-glass sticky top-0 z-30 flex h-14 items-center gap-3 border-x-0 border-t-0 px-4 md:px-6">
        <NavLink
          to="/learn"
          title={t('admin.console.backToApp')}
          className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <img src="/favicon.png" alt={t('app.name')} className="h-8 w-8" />
          <Icon name="arrow_back" className="!text-[18px] text-content-muted md:hidden" />
        </NavLink>
        <span className="lf-label hidden text-content-muted sm:block">{t('admin.console.title')}</span>

        <nav aria-label={t('admin.console.title')} className="flex flex-1 items-center justify-center gap-1.5">
          {SECTIONS.map((s) => (
            <NavLink
              key={s.key}
              to={s.path}
              end
              className={({ isActive }) =>
                cn(
                  'flex min-h-10 items-center rounded-full px-4 transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive ? 'bg-primary-soft font-bold text-primary' : 'text-content-muted hover:bg-surface-sunken hover:text-content',
                )
              }
            >
              <span className="lf-label">{t(`admin.console.sections.${s.key}`)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NavLink to="/profile" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Avatar options={avatarOptions} seed={userId} className="h-9 w-9" />
          </NavLink>
        </div>
      </header>

      <main className="px-5 pb-16 pt-6 md:px-8 lg:pt-10">
        <div className="mx-auto max-w-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
