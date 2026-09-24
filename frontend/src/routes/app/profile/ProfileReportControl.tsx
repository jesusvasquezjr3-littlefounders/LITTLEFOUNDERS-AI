import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Icon } from '@/components/ui';

/*
 * E.3's report control on a public profile. Child-safe by construction:
 * a predefined category plus an optional note capped at 140 characters,
 * the same cap Core enforces. The reporter is always the session user —
 * the client never names one. On success the control collapses into a
 * short confirmation; a failure keeps the form so nothing typed is lost.
 * Rendered next to Block on PublicProfilePage; hidden for self views.
 */

const REPORT_CATEGORIES = ['unwanted_contact', 'harassment', 'inappropriate_content', 'impersonation', 'other'] as const;
const NOTE_MAX = 140;

export function ProfileReportControl({ username }: { username: string }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof REPORT_CATEGORIES)[number]>('unwanted_contact');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true); setFailed(false);
    const token = await getToken();
    const res = await api<{ reported: boolean }>(`/profiles/${username}/report`, {
      method: 'POST',
      token,
      body: { category, note: note.trim() === '' ? undefined : note.trim() },
    });
    setBusy(false);
    if (res.error) {
      setFailed(true);
      return;
    }
    setSent(true); setOpen(false);
  }

  if (sent) {
    return <p className="lf-body text-success-strong" role="status">{t('profile.report.sent')}</p>;
  }

  if (!open) {
    return (
      <Button
        onClick={() => { setOpen(true); setFailed(false); }}
        disabled={busy}
        variant="secondary"
        aria-label={t('profile.report.action')}
        className="gap-2 px-4"
      >
        <Icon name="report" />
        <span className="hidden sm:inline">{t('profile.report.action')}</span>
      </Button>
    );
  }

  return (
    <Card className="flex w-full flex-col gap-3 p-4" role="group" aria-label={t('profile.report.title')}>
      <h2 className="lf-title text-content">{t('profile.report.title')}</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-category`} className="lf-caption font-bold text-content-muted">{t('profile.report.categoryLabel')}</label>
        <select
          id={`${id}-category`}
          className="lf-body rounded-md border border-outline bg-surface px-3 py-2 text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          value={category}
          onChange={(event) => setCategory(event.target.value as (typeof REPORT_CATEGORIES)[number])}
          disabled={busy}
        >
          {REPORT_CATEGORIES.map((value) => (
            <option key={value} value={value}>{t(`profile.report.category.${value}`)}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-note`} className="lf-caption font-bold text-content-muted">{t('profile.report.noteLabel')}</label>
        <textarea
          id={`${id}-note`}
          className="lf-body min-h-20 rounded-md border border-outline bg-surface px-3 py-2 text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          value={note}
          maxLength={NOTE_MAX}
          onChange={(event) => setNote(event.target.value)}
          disabled={busy}
        />
        <span className="lf-caption self-end text-content-faint">{note.length}/{NOTE_MAX}</span>
      </div>
      {failed && <p className="lf-body text-error" role="alert">{t('profile.report.failed')}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void submit()} disabled={busy} variant="primary" className="gap-2">
          <Icon name="report" />
          {busy ? t('profile.report.sending') : t('profile.report.submit')}
        </Button>
        <Button onClick={() => { setOpen(false); setFailed(false); }} disabled={busy} variant="secondary">
          {t('profile.report.cancel')}
        </Button>
      </div>
    </Card>
  );
}
