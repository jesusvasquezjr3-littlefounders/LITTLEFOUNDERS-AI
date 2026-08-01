import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon, StatCard, Table, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminAction, AdminEmpty, AdminPage, RoleChip, Unavailable, useAdminData } from './adminShared';
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

function calculateExactAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
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
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const df = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' });
  const nf = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const usersList = useMemo(() => (data.state === 'ready' ? data.data.users : []), [data]);
  const stats = useMemo(() => (data.state === 'ready' ? computeStats(data.data.users) : null), [data]);

  const staffCount = useMemo(() => {
    return (stats?.roles['admin'] ?? 0) + (stats?.roles['superadmin'] ?? 0);
  }, [stats]);

  const filteredRows = useMemo(() => {
    if (data.state !== 'ready') return [];
    return usersList.filter((u) => {
      const needle = q.trim().toLowerCase();
      const matchesSearch =
        !needle ||
        u.displayName.toLowerCase().includes(needle) ||
        (u.username ?? '').toLowerCase().includes(needle) ||
        u.userId.toLowerCase().includes(needle);

      const matchesRole = roleFilter === 'all' || u.roles.includes(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [data.state, usersList, q, roleFilter]);

  const handleCopyId = useCallback((id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }, []);

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
    { key: 'locale', header: t('admin.users.colLocale'), cell: (u) => <Badge className="bg-surface-sunken text-content-muted text-xs font-mono">{u.locale}</Badge> },
    { key: 'joined', header: t('admin.users.colJoined'), cell: (u) => <span className="lf-caption text-content-muted">{df.format(new Date(u.createdAt))}</span> },
    {
      key: 'actions',
      header: t('admin.users.colActions'),
      cell: (u) => (
        <div className="flex justify-end">
          <AdminAction tone="neutral" icon="visibility" onClick={() => setSelectedUser(u)}>
            {t('admin.users.viewDetail')}
          </AdminAction>
        </div>
      ),
    },
  ];

  return (
    <AdminPage titleKey="admin.users.title" subtitleKey="admin.users.subtitle">
      <div className="flex flex-col gap-6">
        {/* KPI Top Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={<Icon name="group" className="!text-[24px]" />}
              value={nf.format(stats.total)}
              label={t('admin.users.totalUsers')}
              tone="primary"
            />
            <StatCard
              icon={<Icon name="face" className="!text-[24px]" />}
              value={nf.format(stats.roles['kid'] ?? 0)}
              label={t('admin.users.kidsCount')}
              tone="secondary"
            />
            <StatCard
              icon={<Icon name="supervisor_account" className="!text-[24px]" />}
              value={nf.format(stats.roles['parent'] ?? 0)}
              label={t('admin.users.parentsCount')}
              tone="accent"
            />
            <StatCard
              icon={<Icon name="shield_person" className="!text-[24px]" />}
              value={nf.format(staffCount)}
              label={t('admin.users.staffCount')}
              tone="primary"
            />
          </div>
        )}

        {/* ── Stats Distribution Bar ── */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-3">
            {/* Role distribution */}
            <Card className="flex flex-col gap-3 p-4 sm:p-5 shadow-glass border border-outline/50">
              <h3 className="lf-label text-content-muted font-bold">{t('admin.users.statsRoles')}</h3>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-sunken">
                {ROLE_ORDER.filter((r) => stats.roles[r]).map((r) => (
                  <div key={r} className={cn('h-full', ROLE_COLORS[r])} style={{ width: `${((stats.roles[r] ?? 0) / Math.max(stats.total, 1)) * 100}%` }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {ROLE_ORDER.filter((r) => stats.roles[r]).map((r) => (
                  <span key={r} className="lf-caption flex items-center gap-1.5 text-content-muted">
                    <span className={cn('inline-block h-2 w-2 rounded-full', ROLE_COLORS[r])} />
                    {t(`roles.${r}`, r)} <span className="font-bold text-content">{nf.format(stats.roles[r] ?? 0)}</span>
                  </span>
                ))}
              </div>
            </Card>

            {/* Locale distribution */}
            <Card className="flex flex-col gap-3 p-4 sm:p-5 shadow-glass border border-outline/50">
              <h3 className="lf-label text-content-muted font-bold">{t('admin.users.statsLocales')}</h3>
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
                      {label} <span className="font-bold text-content">{nf.format(stats.locales[k] ?? 0)}</span>
                    </span>
                  ))}
              </div>
            </Card>

            {/* Age groups */}
            <Card className="flex flex-col gap-3 p-4 sm:p-5 shadow-glass border border-outline/50">
              <h3 className="lf-label text-content-muted font-bold">{t('admin.users.statsAges')}</h3>
              {Object.keys(stats.ages).length > 0 ? (
                <>
                  <div className="flex items-end gap-1 h-10">
                    {Object.entries(stats.ages).map(([k, v]) => (
                      <div key={k} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-sm bg-accent"
                          style={{ height: `${Math.max((v / Math.max(...Object.values(stats.ages), 1)) * 100, 8)}%` }}
                        />
                        <span className="lf-caption text-content-faint text-xs font-mono">{k}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {Object.entries(stats.ages).map(([k, v]) => (
                      <span key={k} className="lf-caption text-content-muted">
                        {k}: <span className="font-bold text-content">{nf.format(v)}</span>
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

        {/* Search & Role Filter Bar */}
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-glass border border-outline/50">
          <div className="relative flex-1 min-w-[240px]">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 !text-[18px] text-content-muted pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('admin.users.search')}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-full bg-surface-sunken border border-outline/40 text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <div className="flex gap-1 bg-surface-sunken p-1 rounded-full border border-outline/30 overflow-x-auto">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={cn(
                'px-3 py-1 text-xs font-bold rounded-full transition-colors whitespace-nowrap',
                roleFilter === 'all' ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'
              )}
            >
              {t('admin.users.allRoles')}
            </button>
            {ROLE_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={cn(
                  'px-3 py-1 text-xs font-bold rounded-full transition-colors whitespace-nowrap',
                  roleFilter === r ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'
                )}
              >
                {t(`roles.${r}`, r)}
                {stats?.roles[r] !== undefined && (
                  <span className="ml-1 opacity-70">({stats.roles[r]})</span>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* ── User table ── */}
        {data.state === 'error' ? (
          <Unavailable code={data.code} />
        ) : data.state === 'ready' ? (
          filteredRows.length === 0 ? (
            <AdminEmpty icon="group" message={q || roleFilter !== 'all' ? t('admin.users.noMatch') : t('admin.users.empty')} />
          ) : (
            <Table
              columns={columns}
              rows={filteredRows}
              rowKey={(u) => u.userId}
            />
          )
        ) : (
          <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
        )}

        {/* User Detail Inspector Modal */}
        {selectedUser && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setSelectedUser(null)}
          >
            <div
              className="w-full max-w-lg bg-surface border border-outline rounded-2xl p-6 shadow-glass flex flex-col gap-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-outline/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary-soft text-primary">
                    <Icon name="person" className="!text-[26px]" />
                  </div>
                  <div>
                    <h2 className="lf-title text-content font-bold">{selectedUser.displayName}</h2>
                    {selectedUser.username && (
                      <p className="lf-caption text-content-muted font-mono">@{selectedUser.username}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="p-1 rounded-full text-content-muted hover:text-content hover:bg-surface-sunken transition-colors"
                >
                  <Icon name="close" className="!text-[20px]" />
                </button>
              </div>

              {/* User ID Copy Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-sunken/60 border border-outline/40">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="lf-caption text-content-muted">{t('admin.users.colUserId')}</span>
                  <span className="font-mono text-xs text-content truncate font-semibold">{selectedUser.userId}</span>
                </div>
                <AdminAction
                  tone={copiedId ? 'success' : 'neutral'}
                  icon={copiedId ? 'check' : 'content_copy'}
                  onClick={() => handleCopyId(selectedUser.userId)}
                >
                  {copiedId ? t('admin.users.copied') : t('admin.users.copyId')}
                </AdminAction>
              </div>

              {/* Grid Profile Details */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-surface-sunken/30 border border-outline/30 text-sm">
                <div className="col-span-2">
                  <span className="lf-caption text-content-muted block mb-1">{t('admin.users.colRoles')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUser.roles.map((r) => (
                      <RoleChip key={r} role={r} />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="lf-caption text-content-muted block">{t('admin.users.colLocale')}</span>
                  <Badge className="bg-surface text-content-muted text-xs font-mono mt-1">{selectedUser.locale}</Badge>
                </div>
                <div>
                  <span className="lf-caption text-content-muted block">{t('admin.users.colAge')}</span>
                  <span className="lf-body text-content font-bold mt-0.5 block">
                    {calculateExactAge(selectedUser.birthDate) !== null ? `${calculateExactAge(selectedUser.birthDate)} yrs` : '—'}
                  </span>
                </div>
                <div>
                  <span className="lf-caption text-content-muted block">{t('admin.users.colBirthDate')}</span>
                  <span className="lf-caption text-content font-mono mt-0.5 block">{selectedUser.birthDate || '—'}</span>
                </div>
                <div>
                  <span className="lf-caption text-content-muted block">{t('admin.users.colJoined')}</span>
                  <span className="lf-caption text-content font-mono mt-0.5 block">{df.format(new Date(selectedUser.createdAt))}</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end pt-2">
                <AdminAction tone="neutral" onClick={() => setSelectedUser(null)}>
                  {t('admin.users.close')}
                </AdminAction>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
