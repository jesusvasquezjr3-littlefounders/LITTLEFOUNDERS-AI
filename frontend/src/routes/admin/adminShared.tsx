import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
    /*
     * api() is contracted to RETURN an envelope rather than throw, and this
     * hook used to rely on that: `await api(...)` with nothing around it. When
     * something upstream does throw — a rejected token fetch, a mocked client,
     * a future refactor — the rejection escapes an async callback nothing
     * awaits, which surfaces as an unhandled rejection that fails the whole
     * test run (and in a browser, leaves the panel stuck on "loading" forever
     * with no error state). A thrown failure is still a failure: it belongs in
     * the error state like any other.
     */
    try {
      const token = await getToken();
      const r = await api<T>(path, { token });
      setData(r.error ? { state: 'error', code: r.error.code } : { state: 'ready', data: r.data });
    } catch {
      setData({ state: 'error', code: 'INTERNAL' });
    }
  }, [getToken, path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, reload: load };
}

/**
 * Fire an admin action and return the envelope result. POST by default;
 * `method` covers the routes that revoke rather than create.
 */
export function useAdminMutation(): (
  path: string,
  body?: unknown,
  method?: 'POST' | 'PATCH' | 'DELETE',
) => Promise<ApiResult<unknown>> {
  const { getToken } = useAuth();
  return useCallback(
    async (path: string, body?: unknown, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') => {
      // Same contract as useAdminData: callers branch on the envelope, so a
      // thrown failure is converted rather than left to escape as an
      // unhandled rejection that no caller is positioned to catch.
      try {
        const token = await getToken();
        // A DELETE with a JSON body trips some proxies; only send one when there is one.
        return await api<unknown>(path, { method, ...(method === 'DELETE' ? {} : { body: body ?? {} }), token });
      } catch {
        return { data: null, error: { code: 'INTERNAL', message: 'Request failed' } };
      }
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

/**
 * Full-viewport staff dialog. Detached review surfaces must not inherit the
 * page scroll position: the backdrop owns the viewport and only the dialog
 * body scrolls when its content is taller than the screen.
 */
export function AdminDialog({
  title,
  onClose,
  children,
  className,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-base/80 p-4 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('lf-glass flex max-h-[calc(100dvh-2rem)] min-w-0 w-full max-w-4xl flex-col overflow-x-hidden overflow-y-auto rounded-xl p-5 shadow-pop sm:max-h-[calc(100dvh-3rem)] sm:p-7', className)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline/50 pb-4">
          <h2 className="lf-title font-bold text-content">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('admin.close')}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-surface-sunken hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
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
