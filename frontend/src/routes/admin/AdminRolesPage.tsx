import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Dropdown, Field, Icon, StatCard, Table, type DropdownOption, type TableColumn } from '@/components/ui';
import { AdminAction, AdminDialog, AdminEmpty, AdminPage, RoleChip, Unavailable, useAdminData, useAdminMutation } from './adminShared';

interface Holder {
  userId: string;
  displayName: string;
  username: string | null;
  roles: string[];
  permissions: string[];
}

const GRANTABLE = ['parent', 'kid', 'bigfounder', 'admin', 'superadmin'] as const;
type Grantable = (typeof GRANTABLE)[number];

const ADMIN_PERMISSIONS = ['manage_users', 'manage_content', 'view_analytics', 'manage_support'] as const;
type AdminPerm = (typeof ADMIN_PERMISSIONS)[number];

export function AdminRolesPage() {
  const { t } = useTranslation();
  const { data, reload } = useAdminData<{ holders: Holder[] }>('/admin/roles');
  const mutate = useAdminMutation();

  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Grantable>('admin');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Search & Role Filter
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal State
  const [selectedAdmin, setSelectedAdmin] = useState<Holder | null>(null);
  const [permMsg, setPermMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [permBusy, setPermBusy] = useState(false);

  const roleOptions: DropdownOption<Grantable>[] = GRANTABLE.map((r) => ({ value: r, label: t(`roles.${r}`, r) }));
  const holders = useMemo(() => (data.state === 'ready' ? data.data.holders : []), [data]);

  // Statistics
  const totalHolders = holders.length;
  const adminsCount = useMemo(() => holders.filter((h) => h.roles.includes('admin')).length, [holders]);
  const superadminsCount = useMemo(() => holders.filter((h) => h.roles.includes('superadmin')).length, [holders]);
  const privilegedCount = useMemo(() => holders.filter((h) => h.permissions && h.permissions.length > 0).length, [holders]);

  // Filtered Holders
  const filteredHolders = useMemo(() => {
    return holders.filter((h) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        h.displayName.toLowerCase().includes(q) ||
        (h.username && h.username.toLowerCase().includes(q)) ||
        h.userId.toLowerCase().includes(q);

      const matchesRole = roleFilter === 'all' || h.roles.includes(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [holders, search, roleFilter]);

  async function grant() {
    if (!userId.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await mutate('/admin/roles/grant', { userId: userId.trim(), role });
    setBusy(false);
    if (res.error) {
      setMsg({ tone: 'err', text: t(`errors.api.${res.error.code}`, { defaultValue: t('admin.roles.grantFailed') }) });
    } else {
      setMsg({ tone: 'ok', text: t('admin.roles.granted', { role: t(`roles.${role}`, role) }) });
      setUserId('');
      await reload();
    }
  }

  async function revoke(uid: string, r: string) {
    setBusy(true);
    await mutate('/admin/roles/revoke', { userId: uid, role: r });
    setBusy(false);
    await reload();
  }

  async function togglePermission(admin: Holder, perm: AdminPerm, currentlyHas: boolean) {
    setPermBusy(true);
    setPermMsg(null);
    const endpoint = currentlyHas ? '/admin/roles/permissions/revoke' : '/admin/roles/permissions/grant';
    const res = await mutate(endpoint, { userId: admin.userId, permission: perm });
    setPermBusy(false);

    if (res.error) {
      setPermMsg({ tone: 'err', text: t('admin.roles.permissionFailed') });
    } else {
      setPermMsg({ tone: 'ok', text: currentlyHas ? t('admin.roles.permissionRevoked') : t('admin.roles.permissionGranted') });
      await reload();
      setSelectedAdmin((prev) => {
        if (!prev) return prev;
        const newPerms = currentlyHas
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm];
        return { ...prev, permissions: newPerms };
      });
    }
  }

  const columns: TableColumn<Holder>[] = [
    { key: 'name', header: t('admin.roles.colName'), primary: true, cell: (h) => <span className="font-semibold text-content">{h.displayName}</span> },
    { key: 'username', header: t('admin.roles.colUsername'), cell: (h) => (h.username ? <span className="lf-caption text-content-muted">@{h.username}</span> : null) },
    { key: 'id', header: 'ID', cell: (h) => <button type="button" title={h.userId} onClick={() => setUserId(h.userId)} className="lf-caption font-mono text-content-muted hover:text-primary transition-colors">{h.userId.slice(0, 8)}…</button> },
    { key: 'roles', header: t('admin.roles.colRoles'), cell: (h) => <span className="flex flex-wrap gap-1">{h.roles.map((r) => <RoleChip key={r} role={r} />)}</span> },
    {
      key: 'actions',
      header: t('admin.roles.colActions'),
      cell: (h) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {h.roles.map((r) => (
            <AdminAction key={r} tone="danger" icon="remove" onClick={() => void revoke(h.userId, r)} disabled={busy}>
              {t(`roles.${r}`, r)}
            </AdminAction>
          ))}
          {h.roles.includes('admin') && (
            <button
              type="button"
              onClick={() => setSelectedAdmin(h)}
              className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-surface active:scale-95"
            >
              <Icon name="tune" className="!text-[14px]" />
              {t('admin.roles.manageAccess')}
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <AdminPage titleKey="admin.roles.title" subtitleKey="admin.roles.subtitle">
      <div className="flex flex-col gap-6">
        {/* ── KPI STATS HEADER ── */}
        {data.state === 'ready' && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={<Icon name="group" className="!text-[24px]" />}
              value={totalHolders.toString()}
              label={t('admin.roles.totalHolders')}
              tone="primary"
            />
            <StatCard
              icon={<Icon name="admin_panel_settings" className="!text-[24px]" />}
              value={adminsCount.toString()}
              label={t('admin.roles.adminsCount')}
              tone="secondary"
            />
            <StatCard
              icon={<Icon name="shield_person" className="!text-[24px]" />}
              value={superadminsCount.toString()}
              label={t('admin.roles.superadminsCount')}
              tone="accent"
            />
            <StatCard
              icon={<Icon name="key" className="!text-[24px]" />}
              value={privilegedCount.toString()}
              label={t('admin.roles.privilegedCount')}
              tone="primary"
            />
          </div>
        )}

        {/* ── GRANT FORM CARD ── */}
        <Card className="flex flex-col gap-4 p-5 sm:p-6 shadow-glass border border-outline/50">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-primary-soft text-primary">
              <Icon name="verified_user" className="!text-[20px]" />
            </div>
            <h2 className="lf-title font-bold text-content">{t('admin.roles.grantTitle')}</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field
              label={t('admin.roles.userId')}
              hint={t('admin.roles.userIdHint')}
              placeholder="00000000-0000-4000-8000-000000000000"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="flex-1"
            />
            <div className="flex flex-col gap-1.5 w-full sm:w-48">
              <span className="lf-label text-content-muted">{t('admin.roles.role')}</span>
              <Dropdown value={role} options={roleOptions} onChange={setRole} ariaLabel={t('admin.roles.role')} align="left" />
            </div>
            <Button onClick={() => void grant()} disabled={busy || !userId.trim()} className="px-6 h-[42px]">
              {t('admin.roles.grant')}
            </Button>
          </div>
          {msg && (
            <p className={`lf-caption flex items-center gap-1.5 ${msg.tone === 'ok' ? 'text-success-strong' : 'text-error-strong'}`}>
              <Icon name={msg.tone === 'ok' ? 'check_circle' : 'error'} className="!text-[16px]" /> {msg.text}
            </p>
          )}
        </Card>

        {/* ── SEARCH & ROLE FILTER BAR ── */}
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-glass border border-outline/50">
          <div className="relative flex-1 min-w-[240px]">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 !text-[18px] text-content-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.roles.searchPlaceholder')}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-full bg-surface-sunken border border-outline/40 text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto">
            {['all', 'superadmin', 'admin', 'bigfounder', 'parent', 'kid'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  roleFilter === r
                    ? 'bg-primary text-surface shadow-sm'
                    : 'bg-surface-sunken text-content-muted hover:text-content'
                }`}
              >
                {r === 'all' ? t('admin.roles.allRoles') : t(`roles.${r}`, r)}
              </button>
            ))}
          </div>
        </Card>

        {/* ── HOLDERS TABLE ── */}
        <div className="flex flex-col gap-3">
          <h2 className="lf-title font-bold text-content">{t('admin.roles.holdersTitle')}</h2>

          {data.state === 'error' ? (
            <Unavailable code={data.code} />
          ) : data.state === 'ready' ? (
            filteredHolders.length === 0 ? (
              <AdminEmpty icon="admin_panel_settings" message={holders.length === 0 ? t('admin.roles.empty') : t('admin.roles.noMatch')} />
            ) : (
              <Table columns={columns} rows={filteredHolders} rowKey={(h) => h.userId} />
            )
          ) : (
            <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
          )}
        </div>

        {/* ── ADMIN PERMISSIONS MODAL ── */}
        {selectedAdmin && (
          <AdminDialog title={t('admin.roles.accessControlTitle', { name: selectedAdmin.displayName })} onClose={() => setSelectedAdmin(null)} className="max-w-md gap-0">
              <p className="border-b border-outline/50 px-5 py-4 lf-caption text-content-muted">{t('admin.roles.accessControlDesc')}</p>

              {/* Body - Toggles */}
              <div className="p-5 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
                {ADMIN_PERMISSIONS.map((perm) => {
                  const hasPerm = selectedAdmin.permissions.includes(perm);
                  return (
                    <div key={perm} className="flex items-center justify-between gap-4 rounded-xl border border-outline/40 bg-surface-sunken/40 p-4">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="lf-label text-content font-bold">
                          {t(`admin.roles.permissions.${perm}`)}
                        </span>
                        <span className="lf-caption text-content-muted mt-0.5">
                          {t(`admin.roles.permissions.${perm}_desc`)}
                        </span>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={hasPerm}
                        disabled={permBusy}
                        onClick={() => void togglePermission(selectedAdmin, perm, hasPerm)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          hasPerm ? 'bg-success' : 'bg-outline'
                        } ${permBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${
                            hasPerm ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}

                {permMsg && (
                  <div className={`mt-2 flex items-center justify-center gap-2 rounded-xl p-2.5 lf-caption font-semibold ${permMsg.tone === 'ok' ? 'bg-success-soft text-success-strong' : 'bg-error-soft text-error-strong'}`}>
                    <Icon name={permMsg.tone === 'ok' ? 'check_circle' : 'error'} className="!text-[16px]" />
                    {permMsg.text}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-outline/50 bg-surface-sunken p-4 flex justify-end">
                <Button onClick={() => setSelectedAdmin(null)} variant="secondary" className="px-6">
                  {t('admin.audit.close')}
                </Button>
              </div>
          </AdminDialog>
        )}
      </div>
    </AdminPage>
  );
}
