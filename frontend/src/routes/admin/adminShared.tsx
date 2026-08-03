import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api, type ApiResult } from '@/lib/api';
import { Badge, Card, Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { visibleAdminSections } from './adminNav';

/*
 * Shared building blocks for the staff console. Every admin page renders
 * <AdminPage> (title + role chip + the mobile section sub-nav) and pulls data
 * with useAdminData / runs actions with useAdminMutation — one place for the
 * token plumbing, loading/error grammar, and the admin-vs-superadmin cue.
 */

export type Loadable<T> = { state: 'loading' } | { state: 'error'; code: string } | { state: 'ready'; data: T };

export function useAdminData<T>(path: string): { data: Loadable<T>; reload: () => Promise<void> } {
  const { getToken } = useAuth();
  const [data, setData] = useState<Loadable<T>>({ state: 'loading' });
  const load = useCallback(async () => {
    setData({ state: 'loading' });
    const token = await getToken();
    const r = await api<T>(path, { token });
    setData(r.error ? { state: 'error', code: r.error.code } : { state: 'ready', data: r.data });
  }, [getToken, path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, reload: load };
}

/** Fire a POST admin action and return the envelope result. */
export function useAdminMutation(): (path: string, body?: unknown) => Promise<ApiResult<unknown>> {
  const { getToken } = useAuth();
  return useCallback(
    async (path: string, body?: unknown) => {
      const token = await getToken();
      return api<unknown>(path, { method: 'POST', body: body ?? {}, token });
    },
    [getToken],
  );
}

/** Content/lesson status → Badge tone. Single source so every table agrees. */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone: Record<string, string> = {
    published: 'bg-success-soft text-success-strong',
    review: 'bg-warning-soft text-warning-strong',
    draft: 'bg-surface-sunken text-content-muted',
    archived: 'bg-surface-sunken text-content-faint',
  };
  return <Badge className={tone[status] ?? 'bg-surface-sunken text-content-muted'}>{t(`admin.status.${status}`, status)}</Badge>;
}

/** Role → chip. superadmin gets the indigo accent so it reads as the top tier. */
export function RoleChip({ role }: { role: string }) {
  const { t } = useTranslation();
  const tone: Record<string, string> = {
    superadmin: 'bg-accent-soft text-accent-strong',
    admin: 'bg-primary-soft text-primary',
    bigfounder: 'bg-delight-soft text-delight-strong',
    parent: 'bg-success-soft text-success-strong',
    kid: 'bg-surface-sunken text-content-muted',
    universal: 'bg-surface-sunken text-content-faint',
  };
  return <Badge className={cn('font-bold', tone[role] ?? 'bg-surface-sunken text-content-muted')}>{t(`roles.${role}`, role)}</Badge>;
}

/** Compact row-level action (the system Button is a large CTA pill; tables and
 * lists need something small). Tone by what the action does, per DESIGN. */
export function AdminAction({
  tone = 'neutral',
  icon,
  children,
  onClick,
  disabled,
}: {
  tone?: 'primary' | 'success' | 'danger' | 'neutral';
  icon?: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  const tones: Record<string, string> = {
    primary: 'bg-primary-soft text-primary hover:bg-primary-soft/70',
    success: 'bg-success-soft text-success-strong hover:bg-success-soft/70',
    danger: 'bg-error-soft text-error-strong hover:bg-error-soft/70',
    neutral: 'bg-surface-sunken text-content-muted hover:bg-outline/50 hover:text-content',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'motion-safe-press lf-caption inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 font-bold transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50',
        tones[tone],
      )}
    >
      {icon && <Icon name={icon} className="!text-[16px]" />}
      {children}
    </button>
  );
}

export function Unavailable({ code }: { code: string }) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col items-center gap-2 py-12 text-center">
      <Icon name="cloud_off" className="!text-[40px] text-content-faint" />
      <p className="lf-label text-content">{t('admin.unavailable.title')}</p>
      <p className="lf-caption max-w-sm text-content-muted">
        {t(`errors.api.${code}`, { defaultValue: t('admin.unavailable.body') })}
      </p>
    </Card>
  );
}

export function AdminEmpty({ icon, message }: { icon: string; message: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-12 text-center">
      <Icon name={icon} className="!text-[40px] text-content-faint" />
      <p className="lf-caption text-content-muted">{message}</p>
    </Card>
  );
}

/** Horizontal section pills — the admin nav on mobile (the desktop sidebar
 * already carries the Staff group, so this is `lg:hidden`). */
function AdminSubnav() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  return (
    <nav className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 lg:hidden" aria-label={t('admin.title')}>
      {visibleAdminSections(roles).map((s) => (
        <NavLink
          key={s.key}
          to={s.path}
          end={s.path === '/admin'}
          className={({ isActive }) =>
            cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 transition-colors duration-150',
              isActive ? 'bg-primary-soft font-bold text-primary' : 'bg-surface-sunken text-content-muted',
            )
          }
        >
          <Icon name={s.icon} className="!text-[18px]" />
          <span className="lf-caption font-bold">{t(`admin.nav.${s.key}`)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/** Every admin page: mobile sub-nav + title row with the role chip + content. */
export function AdminPage({
  titleKey,
  subtitleKey,
  actions,
  children,
}: {
  titleKey: string;
  subtitleKey?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const tier = roles.includes('superadmin') ? 'superadmin' : 'admin';
  return (
    <div className="flex flex-col gap-6">
      <AdminSubnav />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="lf-display-lg">{t(titleKey)}</h1>
            <RoleChip role={tier} />
          </div>
          {subtitleKey && <p className="lf-body-sm mt-1 text-content-muted">{t(subtitleKey)}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
