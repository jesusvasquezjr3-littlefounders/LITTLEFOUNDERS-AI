import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon, SectionHeading, StatCard, Table, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminAction, AdminDialog, AdminEmpty, AdminPage, RoleChip, Unavailable, useAdminData } from './adminShared';
import { UsersFunnelCard } from './UsersFunnelCard';
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
const LOCALE_ORDER = ['en-US', 'es-MX', 'pt-BR'] as const;
const LOCALE_COLORS: Record<string, string> = { 'en-US': 'bg-primary', 'es-MX': 'bg-accent', 'pt-BR': 'bg-success' };

function calculateExactAge(birthDate: string | null, today = new Date()): number | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
  let age = today.getFullYear() - year;
  const birthdayPassed = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age >= 0 ? age : null;
}

function ageGroup(birthDate: string | null): string | null {
  const age = calculateExactAge(birthDate);
  if (age === null) return null;
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
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const df = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' });
  const birthDf = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });
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

  const handleCopyId = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch {
      setCopiedId(null);
    }
  }, []);

  const columns: TableColumn<User>[] = [
    {
      key: 'name',
      header: t('admin.users.colName'),
      primary: true,
      cell: (u) => <span className={cn(!u.displayName && 'text-content-muted')}>{u.displayName || t('admin.users.unnamed')}</span>,
    },
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

        {/*
          The people who are NOT in the table below. Every other number on this
          page counts accounts, which answers a question nobody asked on a
          product whose whole problem is whether strangers ever become one.
        */}
        <UsersFunnelCard />

        {/* ── Stats Distribution Bar ── */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-3">
            {/* Role distribution */}
            <Card className="flex flex-col gap-3 p-4 sm:p-5 shadow-glass border border-outline/50">
              <SectionHeading icon="badge" tone="delight" as="h3" className="mb-0">{t('admin.users.statsRoles')}</SectionHeading>
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
              <SectionHeading icon="translate" tone="success" as="h3" className="mb-0">{t('admin.users.statsLocales')}</SectionHeading>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-sunken">
                {LOCALE_ORDER.filter((k) => stats.locales[k]).map((k) => (
                    <div key={k} className={cn('h-full', LOCALE_COLORS[k] ?? 'bg-primary')} style={{ width: `${((stats.locales[k] ?? 0) / Math.max(stats.total, 1)) * 100}%` }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {LOCALE_ORDER.filter((k) => stats.locales[k]).map((k) => (
                    <span key={k} className="lf-caption flex items-center gap-1.5 text-content-muted">
                      <span className={cn('inline-block h-2 w-2 rounded-full', LOCALE_COLORS[k] ?? 'bg-primary')} />
                      {t(`admin.users.locales.${k}`, k)} <span className="font-bold text-content">{nf.format(stats.locales[k] ?? 0)}</span>
                    </span>
                ))}
              </div>
            </Card>

            {/* Age groups */}
            <Card className="flex flex-col gap-3 p-4 sm:p-5 shadow-glass border border-outline/50">
              <SectionHeading icon="cake" tone="accent" as="h3" className="mb-0">{t('admin.users.statsAges')}</SectionHeading>
              {Object.keys(stats.ages).length > 0 ? (
                <>
                  <div className="flex items-end gap-1 h-10">
                    {Object.entries(stats.ages).map(([k, v]) => (
                      <div key={k} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-sm bg-accent"
                          style={{ height: `${Math.max((v / Math.max(...Object.values(stats.ages), 1)) * 100, 8)}%` }}
                        />
                        <span className="lf-caption text-content-faint text-xs font-mono">{t(`admin.users.ageGroups.${k}`, k)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {Object.entries(stats.ages).map(([k, v]) => (
                      <span key={k} className="lf-caption text-content-muted">
                        {t(`admin.users.ageGroups.${k}`, k)}: <span className="font-bold text-content">{nf.format(v)}</span>
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
          <div className="relative min-w-[min(100%,240px)] flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 !text-[18px] text-content-muted pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={t('admin.users.searchLabel')}
              placeholder={t('admin.users.search')}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-md bg-surface-sunken border border-outline/40 text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-outline/30 bg-surface-sunken p-1">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={cn(
                'min-h-11 whitespace-nowrap rounded-full px-3 text-xs font-bold transition-colors',
                roleFilter === 'all' ? 'bg-content text-base shadow-sm' : 'text-content-muted hover:text-content'
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
                  'min-h-11 whitespace-nowrap rounded-full px-3 text-xs font-bold transition-colors',
                  roleFilter === r ? 'bg-content text-base shadow-sm' : 'text-content-muted hover:text-content'
                )}
              >
                {t(`roles.${r}`, r)}
                {stats?.roles[r] !== undefined && (
                  <span className="ml-1 opacity-70">({stats.roles[r]})</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex w-full items-center justify-between gap-3 border-t border-outline/30 pt-3">
            <p className="lf-caption text-content-muted">
              {t('admin.users.resultCount', { visible: nf.format(filteredRows.length), total: nf.format(usersList.length) })}
            </p>
            {(q || roleFilter !== 'all') && (
              <AdminAction tone="neutral" icon="filter_alt_off" onClick={() => { setQ(''); setRoleFilter('all'); }}>
                {t('admin.users.clearFilters')}
              </AdminAction>
            )}
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
              onRowClick={(u) => setSelectedUser(u)}
            />
          )
        ) : (
          <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
        )}

        {/* User Detail Inspector Modal */}
        {selectedUser && (
          <AdminDialog
            title={selectedUser.displayName || t('admin.users.unnamed')}
            onClose={() => setSelectedUser(null)}
            className="max-w-2xl gap-5"
          >
            <div className="flex flex-wrap items-center gap-3 border-b border-outline/50 pb-4">
              <Icon name="person" className="!text-[28px] text-primary" />
              <div className="min-w-0">
                <p className="lf-caption text-content-muted">{t('admin.users.profileSnapshot')}</p>
                {selectedUser.username && <p className="lf-caption text-content-muted font-mono">@{selectedUser.username}</p>}
              </div>
              {selectedUser.roles[0] && <RoleChip role={selectedUser.roles[0]} />}
            </div>

            <div className="flex flex-col gap-4">
              <p className="lf-caption max-w-2xl text-content-muted">{t('admin.users.detailReadOnly')}</p>

              <div className="grid gap-3 rounded-md bg-surface-sunken/40 p-4 sm:grid-cols-2">
                <div className="min-w-0 sm:col-span-2">
                  <span className="lf-caption text-content-muted">{t('admin.users.colUserId')}</span>
                  <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-xs font-semibold text-content">{selectedUser.userId}</span>
                    <AdminAction
                      tone={copiedId === selectedUser.userId ? 'success' : 'neutral'}
                      icon={copiedId === selectedUser.userId ? 'check' : 'content_copy'}
                      onClick={() => { void handleCopyId(selectedUser.userId); }}
                    >
                      {copiedId === selectedUser.userId ? t('admin.users.copied') : t('admin.users.copyId')}
                    </AdminAction>
                  </div>
                </div>
                <div>
                  <span className="lf-caption text-content-muted">{t('admin.users.colRoles')}</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {selectedUser.roles.length ? selectedUser.roles.map((r) => <RoleChip key={r} role={r} />) : <span className="lf-caption text-content-muted">{t('admin.users.notAvailable')}</span>}
                  </div>
                </div>
                <div>
                  <span className="lf-caption text-content-muted">{t('admin.users.colLocale')}</span>
                  <Badge className="mt-1 bg-surface text-content-muted text-xs font-mono">{selectedUser.locale}</Badge>
                </div>
                <div>
                  <span className="lf-caption text-content-muted">{t('admin.users.colAge')}</span>
                  <span className="lf-body mt-1 block font-bold text-content">
                    {calculateExactAge(selectedUser.birthDate) !== null
                      ? t('admin.users.ageYears', { count: calculateExactAge(selectedUser.birthDate) ?? 0 })
                      : t('admin.users.notAvailable')}
                  </span>
                </div>
                <div>
                  <span className="lf-caption text-content-muted">{t('admin.users.colBirthDate')}</span>
                  <span className="lf-caption mt-1 block font-mono text-content">
                    {selectedUser.birthDate ? birthDf.format(new Date(`${selectedUser.birthDate}T12:00:00`)) : t('admin.users.notAvailable')}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="lf-caption text-content-muted">{t('admin.users.colJoined')}</span>
                  <span className="lf-caption mt-1 block font-mono text-content">{df.format(new Date(selectedUser.createdAt))}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <AdminAction tone="neutral" onClick={() => setSelectedUser(null)}>
                {t('admin.users.close')}
              </AdminAction>
            </div>
          </AdminDialog>
        )}
      </div>
    </AdminPage>
  );
}
