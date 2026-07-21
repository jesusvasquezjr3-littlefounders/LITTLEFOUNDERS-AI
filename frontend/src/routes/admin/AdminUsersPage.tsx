import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Field, Table, type TableColumn } from '@/components/ui';
import { AdminEmpty, AdminPage, RoleChip, Unavailable, useAdminData } from './adminShared';

interface User {
  userId: string;
  displayName: string;
  username: string | null;
  locale: string;
  createdAt: string;
  roles: string[];
}

export function AdminUsersPage() {
  const { t, i18n } = useTranslation();
  const { data } = useAdminData<{ users: User[] }>('/admin/users');
  const [q, setQ] = useState('');

  const df = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });

  const rows = useMemo(() => {
    if (data.state !== 'ready') return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data.data.users;
    return data.data.users.filter(
      (u) => u.displayName.toLowerCase().includes(needle) || (u.username ?? '').toLowerCase().includes(needle),
    );
  }, [data, q]);

  const columns: TableColumn<User>[] = [
    { key: 'name', header: t('admin.users.colName'), primary: true, cell: (u) => u.displayName },
    { key: 'username', header: t('admin.users.colUsername'), cell: (u) => (u.username ? <span className="lf-number text-content-muted">@{u.username}</span> : '—') },
    {
      key: 'roles',
      header: t('admin.users.colRoles'),
      cell: (u) => (
        <span className="flex flex-wrap gap-1">
          {u.roles.length ? u.roles.map((r) => <RoleChip key={r} role={r} />) : <span className="text-content-faint">—</span>}
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
