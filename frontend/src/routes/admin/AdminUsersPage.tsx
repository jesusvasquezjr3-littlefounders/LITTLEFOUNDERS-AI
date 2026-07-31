import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Field, Table, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminEmpty, AdminPage, RoleChip, Unavailable, useAdminData } from './adminShared';
import { SignupTimeline } from './SignupTimeline';

interface User {
  userId: string;
  displayName: string;
  username: string | null;
  locale: string;
  createdAt: string;
  birthDate: string | null;
  roles: string[];
}

const ROLE_ORDER = ['superadmin', 'admin', 'bigfounder', 'parent', 'kid', 'universal'] as const;
const LOCALE_LABELS: Record<string, string> = { 'en-US': 'English', 'es-MX': 'Español', 'pt-BR': 'Português' };
const LOCALE_COLORS: Record<string, string> = { 'en-US': 'bg-primary', 'es-MX': 'bg-accent', 'pt-BR': 'bg-success' };

function ageGroup(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 6) return 'lt6';
  if (age <= 8) return '6-8';
  if (age <= 10) return '9-10';
  if (age <= 12) return '11-12';
  if (age <= 17) return '13-17';
  return '18+';
}

interface Stats {
  roles: Record<string, number>;
  locales: Record<string, number>;
  ages: Record<string, number>;
  total: number;
}

function topRole(roles: string[]): string {
  for (const r of ROLE_ORDER) if (roles.includes(r)) return r;
  return 'universal';
}

function computeStats(users: User[]): Stats {
  const roles: Record<string, number> = {};
  const locales: Record<string, number> = {};
  const ages: Record<string, number> = {};
  for (const u of users) {
    const tr = topRole(u.roles);
    roles[tr] = (roles[tr] ?? 0) + 1;
    locales[u.locale] = (locales[u.locale] ?? 0) + 1;
    const ag = ageGroup(u.birthDate);
    if (ag) ages[ag] = (ages[ag] ?? 0) + 1;
  }
  return { roles, locales, ages, total: users.length };
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-accent',
  admin: 'bg-primary',
  bigfounder: 'bg-delight',
  parent: 'bg-success',
  kid: 'bg-warning',
  universal: 'bg-content-faint/40',
};

export function AdminUsersPage() {
  const { t, i18n } = useTranslation();
  const { data } = useAdminData<{ users: User[] }>('/admin/users');
  const [q, setQ] = useState('');

  const df = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });
  const nf = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const rows = useMemo(() => {
    if (data.state !== 'ready') return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data.data.users;
    return data.data.users.filter(
      (u) => u.displayName.toLowerCase().includes(needle) || (u.username ?? '').toLowerCase().includes(needle),
    );
  }, [data, q]);

  const stats = useMemo(() => (data.state === 'ready' ? computeStats(data.data.users) : null), [data]);

  const columns: TableColumn<User>[] = [
    { key: 'name', header: t('admin.users.colName'), primary: true, cell: (u) => u.displayName },
    { key: 'username', header: t('admin.users.colUsername'), cell: (u) => (u.username ? <span className="lf-number text-content-muted">@{u.username}</span> : null) },
    {
      key: 'roles',
      header: t('admin.users.colRoles'),
      cell: (u) => (
        <span className="flex flex-wrap gap-1">
          {u.roles.length ? u.roles.map((r) => <RoleChip key={r} role={r} />) : null}
        </span>
      ),
    },
    { key: 'locale', header: t('admin.users.colLocale'), cell: (u) => u.locale },
    { key: 'joined', header: t('admin.users.colJoined'), cell: (u) => <span className="lf-number">{df.format(new Date(u.createdAt))}</span> },
  ];

  return (
    <AdminPage
      titleKey="admin.users.title"
      subtitleKey="admin.users.subtitle"
      actions={
        <Field
          label=""
          aria-label={t('admin.users.search')}
          placeholder={t('admin.users.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
      }
    >
      {/* ── Stats bar ── */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Role distribution */}
          <Card className="flex flex-col gap-3 p-4 sm:p-5 shadow-glass border border-outline/50">
            <h3 className="lf-label text-content-muted">{t('admin.users.statsRoles')}</h3>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-sunken">
              {ROLE_ORDER.filter((r) => stats.roles[r]).map((r) => (
                <div key={r} className={cn('h-full', ROLE_COLORS[r])} style={{ width: `${((stats.roles[r] ?? 0) / Math.max(stats.total, 1)) * 100}%` }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {ROLE_ORDER.filter((r) => stats.roles[r]).map((r) => (
                <span key={r} className="lf-caption flex items-center gap-1.5 text-content-muted">
                  <span className={cn('inline-block h-2 w-2 rounded-full', ROLE_COLORS[r])} />
                  {t(`roles.${r}`, r)} {nf.format(stats.roles[r] ?? 0)}
                </span>
              ))}
            </div>
          </Card>

          {/* Locale distribution */}
          <Card className="flex flex-col gap-3 p-4 sm:p-5 shadow-glass border border-outline/50">
            <h3 className="lf-label text-content-muted">{t('admin.users.statsLocales')}</h3>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-sunken">
              {Object.entries(LOCALE_LABELS)
                .filter(([k]) => stats.locales[k])
                .map(([k]) => (
                  <div key={k} className={cn('h-full', LOCALE_COLORS[k] ?? 'bg-primary')} style={{ width: `${((stats.locales[k] ?? 0) / Math.max(stats.total, 1)) * 100}%` }} />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(LOCALE_LABELS)
                .filter(([k]) => stats.locales[k])
                .map(([k, label]) => (
                  <span key={k} className="lf-caption flex items-center gap-1.5 text-content-muted">
                    <span className={cn('inline-block h-2 w-2 rounded-full', LOCALE_COLORS[k] ?? 'bg-primary')} />
                    {label} {nf.format(stats.locales[k] ?? 0)}
                  </span>
                ))}
            </div>
          </Card>

          {/* Age groups */}
          <Card className="flex flex-col gap-3 p-4 sm:p-5 shadow-glass border border-outline/50">
            <h3 className="lf-label text-content-muted">{t('admin.users.statsAges')}</h3>
            {Object.keys(stats.ages).length > 0 ? (
              <>
                <div className="flex items-end gap-1 h-10">
                  {Object.entries(stats.ages).map(([k, v]) => (
                    <div key={k} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-sm bg-accent"
                        style={{ height: `${Math.max((v / Math.max(...Object.values(stats.ages), 1)) * 100, 8)}%` }}
                      />
                      <span className="lf-caption text-content-faint">{k}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {Object.entries(stats.ages).map(([k, v]) => (
                    <span key={k} className="lf-caption text-content-muted">
                      {k}: {nf.format(v)}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="lf-caption text-content-faint">{t('admin.users.statsAgesEmpty')}</p>
            )}
          </Card>
        </div>
      )}
      {/* ── Signup timeline ── */}
      <SignupTimeline />

      {/* ── User table ── */}
      {data.state === 'error' ? (
        <Unavailable code={data.code} />
      ) : data.state === 'ready' ? (
        rows.length === 0 ? (
          <AdminEmpty icon="group" message={q ? t('admin.users.noMatch') : t('admin.users.empty')} />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(u) => u.userId} />
        )
      ) : (
        <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
      )}
    </AdminPage>
  );
}
