import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, type TableColumn } from '@/components/ui';
import { AdminAction, AdminEmpty, AdminPage, StatusBadge, Unavailable, useAdminData, useAdminMutation } from './adminShared';

interface Course {
  id: string;
  slug: string;
  title: string;
  subject: string;
  status: string;
  position: number;
}

export function AdminContentPage() {
  const { t } = useTranslation();
  const { data, reload } = useAdminData<{ courses: Course[] }>('/admin/content');
  const mutate = useAdminMutation();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    await mutate(`/admin/content/${id}/status`, { status });
    await reload();
    setBusy(null);
  }

  const columns: TableColumn<Course>[] = [
    { key: 'title', header: t('admin.content.colTitle'), primary: true, cell: (c) => c.title },
    { key: 'slug', header: t('admin.content.colSlug'), cell: (c) => <span className="lf-number text-content-muted">{c.slug}</span> },
    { key: 'subject', header: t('admin.content.colSubject'), cell: (c) => c.subject },
    { key: 'status', header: t('admin.content.colStatus'), cell: (c) => <StatusBadge status={c.status} /> },
    {
      key: 'actions',
      header: t('admin.content.colActions'),
      cell: (c) => (
        <div className="flex flex-wrap gap-1.5">
          {c.status !== 'published' && (
            <AdminAction tone="success" icon="publish" onClick={() => void setStatus(c.id, 'published')} disabled={busy === c.id}>
              {t('admin.content.publish')}
            </AdminAction>
          )}
          {c.status === 'published' && (
            <AdminAction tone="neutral" icon="unpublished" onClick={() => void setStatus(c.id, 'draft')} disabled={busy === c.id}>
              {t('admin.content.unpublish')}
            </AdminAction>
          )}
          {c.status !== 'archived' && (
            <AdminAction tone="neutral" icon="archive" onClick={() => void setStatus(c.id, 'archived')} disabled={busy === c.id}>
              {t('admin.content.archive')}
            </AdminAction>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminPage titleKey="admin.content.title" subtitleKey="admin.content.subtitle">
      {data.state === 'error' ? (
        <Unavailable code={data.code} />
      ) : data.state === 'ready' ? (
        data.data.courses.length === 0 ? (
          <AdminEmpty icon="menu_book" message={t('admin.content.empty')} />
        ) : (
          <Table columns={columns} rows={data.data.courses} rowKey={(c) => c.id} />
        )
      ) : (
        <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
      )}
    </AdminPage>
  );
}
