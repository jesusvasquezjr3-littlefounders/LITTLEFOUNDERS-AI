import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Dropdown, Field, Icon, Table, type DropdownOption, type TableColumn } from '@/components/ui';
import { AdminAction, AdminEmpty, AdminPage, RoleChip, Unavailable, useAdminData, useAdminMutation } from './adminShared';

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

  // Modal State
  const [selectedAdmin, setSelectedAdmin] = useState<Holder | null>(null);
  const [permMsg, setPermMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [permBusy, setPermBusy] = useState(false);

  const roleOptions: DropdownOption<Grantable>[] = GRANTABLE.map((r) => ({ value: r, label: t(`roles.${r}`, r) }));

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
      // Update local state so modal feels snappy if reload takes a moment
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
    { key: 'name', header: t('admin.roles.colName'), primary: true, cell: (h) => h.displayName },
    { key: 'username', header: t('admin.roles.colUsername'), cell: (h) => (h.username ? <span className="lf-number text-content-muted">@{h.username}</span> : null) },
    { key: 'id', header: 'ID', cell: (h) => <button type="button" title={h.userId} onClick={() => setUserId(h.userId)} className="lf-number text-content-muted hover:text-primary">{h.userId.slice(0, 8)}…</button> },
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
              className="flex items-center gap-1 rounded-full border border-outline bg-surface px-2 py-1 lf-caption text-primary transition-colors hover:border-primary hover:text-primary-strong active:scale-95"
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
      
      {/* ── GRANT FORM ── */}
      <Card className="mb-8 flex flex-col gap-4 p-5 sm:p-6 shadow-pop border border-outline/50">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="verified_user" className="text-primary" />
          <h2 className="lf-title">{t('admin.roles.grantTitle')}</h2>
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
            <span className="lf-label text-content">{t('admin.roles.role')}</span>
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

      {/* ── HOLDERS ── */}
      <div className="flex flex-col gap-4">
        <h2 className="lf-title">{t('admin.roles.holdersTitle')}</h2>
        
        {data.state === 'error' ? (
          <Unavailable code={data.code} />
        ) : data.state === 'ready' ? (
          data.data.holders.length === 0 ? (
            <AdminEmpty icon="admin_panel_settings" message={t('admin.roles.empty')} />
          ) : (
            <Table columns={columns} rows={data.data.holders} rowKey={(h) => h.userId} />
          )
        ) : (
          <AdminEmpty icon="hourglass_empty" message={t('admin.loading', { defaultValue: 'Loading...' })} />
        )}
      </div>

      {/* ── ADMIN PERMISSIONS MODAL ── */}
      {selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedAdmin(null)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-surface shadow-pop border border-outline">
            {/* Header */}
            <div className="border-b border-outline bg-surface-sunken p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="lf-title text-content-strong">
                    {t('admin.roles.accessControlTitle', { name: selectedAdmin.displayName })}
                  </h3>
                  <p className="mt-1 lf-caption text-content-muted">{t('admin.roles.accessControlDesc')}</p>
                </div>
                <button 
                  onClick={() => setSelectedAdmin(null)}
                  className="rounded-full p-1.5 text-content-muted hover:bg-surface hover:text-content-strong transition-colors"
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>

            {/* Body - Toggles */}
            <div className="p-5 sm:p-6 flex flex-col gap-4">
              {ADMIN_PERMISSIONS.map((perm) => {
                const hasPerm = selectedAdmin.permissions.includes(perm);
                return (
                  <div key={perm} className="flex items-center justify-between gap-4 rounded-lg border border-outline bg-surface p-4">
                    <div className="flex flex-col">
                      <span className="lf-label text-content-strong">
                        {t(`admin.roles.permissions.${perm}`)}
                      </span>
                      <span className="lf-caption text-content-muted mt-0.5">
                        {t(`admin.roles.permissions.${perm}_desc`)}
                      </span>
                    </div>
                    
                    {/* CSS-only Toggle Switch */}
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
                <div className={`mt-2 flex items-center justify-center gap-2 rounded-md p-2 lf-caption ${permMsg.tone === 'ok' ? 'bg-success-soft text-success-strong' : 'bg-error-soft text-error-strong'}`}>
                  <Icon name={permMsg.tone === 'ok' ? 'check_circle' : 'error'} className="!text-[14px]" />
                  {permMsg.text}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t border-outline bg-surface-sunken p-4 sm:p-5 flex justify-end">
              <Button onClick={() => setSelectedAdmin(null)} variant="secondary" className="px-6">
                {t('admin.close', { defaultValue: 'Close' })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
