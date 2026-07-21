import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Dropdown, Field, Icon, Table, type DropdownOption, type TableColumn } from '@/components/ui';
import { AdminAction, AdminEmpty, AdminPage, RoleChip, Unavailable, useAdminData, useAdminMutation } from './adminShared';

interface Holder {
  userId: string;
  displayName: string;
  username: string | null;
  roles: string[];
}

const GRANTABLE = ['parent', 'kid', 'bigfounder', 'admin', 'superadmin'] as const;
type Grantable = (typeof GRANTABLE)[number];

export function AdminRolesPage() {
  const { t } = useTranslation();
  const { data, reload } = useAdminData<{ holders: Holder[] }>('/admin/roles');
  const mutate = useAdminMutation();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Grantable>('admin');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

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

  const columns: TableColumn<Holder>[] = [
    { key: 'name', header: t('admin.roles.colName'), primary: true, cell: (h) => h.displayName },
    { key: 'username', header: t('admin.roles.colUsername'), cell: (h) => (h.username ? <span className="lf-number text-content-muted">@{h.username}</span> : '—') },
    { key: 'id', header: 'ID', cell: (h) => <button type="button" title={h.userId} onClick={() => setUserId(h.userId)} className="lf-number text-content-muted hover:text-primary">{h.userId.slice(0, 8)}…</button> },
    { key: 'roles', header: t('admin.roles.colRoles'), cell: (h) => <span className="flex flex-wrap gap-1">{h.roles.map((r) => <RoleChip key={r} role={r} />)}</span> },
    {
      key: 'actions',
      header: t('admin.roles.colActions'),
      cell: (h) => (
        <span className="flex flex-wrap gap-1.5">
          {h.roles.map((r) => (
            <AdminAction key={r} tone="danger" icon="remove" onClick={() => void revoke(h.userId, r)} disabled={busy}>
              {t(`roles.${r}`, r)}
            </AdminAction>
          ))}
        </span>
      ),
    },
  ];

  return (
    <AdminPage titleKey="admin.roles.title" subtitleKey="admin.roles.subtitle">
      {/* Grant form */}
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="lf-title">{t('admin.roles.grantTitle')}</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field
            label={t('admin.roles.userId')}
            hint={t('admin.roles.userIdHint')}
            placeholder="00000000-0000-4000-8000-000000000000"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="flex-1"
          />
          <div className="flex flex-col gap-1.5">
            <span className="lf-label text-content">{t('admin.roles.role')}</span>
            <Dropdown value={role} options={roleOptions} onChange={setRole} ariaLabel={t('admin.roles.role')} align="left" />
          </div>
          <Button onClick={() => void grant()} disabled={busy || !userId.trim()} className="px-6 py-3">
            {t('admin.roles.grant')}
          </Button>
        </div>
        {msg && (
          <p className={`lf-caption flex items-center gap-1.5 ${msg.tone === 'ok' ? 'text-success-strong' : 'text-error-strong'}`}>
            <Icon name={msg.tone === 'ok' ? 'check_circle' : 'error'} className="!text-[16px]" /> {msg.text}
          </p>
        )}
      </Card>

      {/* Holders */}
      <div className="flex flex-col gap-2">
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
          <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
        )}
      </div>
    </AdminPage>
  );
}
