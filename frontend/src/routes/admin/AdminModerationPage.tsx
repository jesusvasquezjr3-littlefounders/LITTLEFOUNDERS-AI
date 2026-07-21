import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Icon } from '@/components/ui';
import { AdminAction, AdminEmpty, AdminPage, Unavailable, useAdminData, useAdminMutation } from './adminShared';

interface ReviewLesson {
  id: string;
  slug: string;
  title: string;
  status: string;
}

export function AdminModerationPage() {
  const { t } = useTranslation();
  const { data, reload } = useAdminData<{ lessons: ReviewLesson[] }>('/admin/moderation');
  const mutate = useAdminMutation();
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, status: 'published' | 'draft') {
    setBusy(id);
    await mutate(`/admin/moderation/${id}/status`, { status });
    await reload();
    setBusy(null);
  }

  return (
    <AdminPage titleKey="admin.moderation.title" subtitleKey="admin.moderation.subtitle">
      {/* §1.9 — the human gate for kid-facing content */}
      <div className="flex items-start gap-2.5 rounded-lg bg-primary-soft px-4 py-3 text-primary">
        <Icon name="shield" className="mt-0.5 shrink-0" />
        <p className="lf-caption">{t('admin.moderation.note')}</p>
      </div>

      {data.state === 'error' ? (
        <Unavailable code={data.code} />
      ) : data.state === 'ready' ? (
        data.data.lessons.length === 0 ? (
          <AdminEmpty icon="task_alt" message={t('admin.moderation.empty')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.data.lessons.map((l) => (
              <li key={l.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="lf-label truncate text-content">{l.title}</p>
                    <p className="lf-number lf-caption text-content-muted">{l.slug}</p>
                  </div>
                  <div className="flex gap-2">
                    <AdminAction tone="success" icon="check" onClick={() => void decide(l.id, 'published')} disabled={busy === l.id}>
                      {t('admin.moderation.approve')}
                    </AdminAction>
                    <AdminAction tone="danger" icon="undo" onClick={() => void decide(l.id, 'draft')} disabled={busy === l.id}>
                      {t('admin.moderation.reject')}
                    </AdminAction>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : (
        <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
      )}
    </AdminPage>
  );
}
