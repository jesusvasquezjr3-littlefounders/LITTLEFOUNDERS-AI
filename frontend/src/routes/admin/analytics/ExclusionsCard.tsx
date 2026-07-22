import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Field, Icon } from '@/components/ui';
import { AdminAction, useAdminData } from '../adminShared';

/*
 * Excluded IPs (superadmin only). Core's /admin/analytics/exclusions is a
 * READ-ONLY mirror of what Plausible actually enforces via its IP_BLOCKLIST
 * env on pulse-plausible — there is no write endpoint by design. The editor
 * below is client-side only: it computes the resulting blocklist and shows the
 * copy-ready `railway variables --set` command; applying it is an infra step
 * (redeploy), stated honestly in the note.
 */

/** Permissive IPv4/IPv6 shape (optionally CIDR) — Plausible does the real parsing. */
const IP_RE = /^[0-9A-Fa-f.:]+(\/\d{1,3})?$/;

export function ExclusionsCard() {
  const { t } = useTranslation();
  const { data } = useAdminData<{ ips: string[] }>('/admin/analytics/exclusions');
  const [edited, setEdited] = useState<string[] | null>(null);
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [copied, setCopied] = useState(false);

  const serverIps = data.state === 'ready' ? data.data.ips : [];
  const ips = edited ?? serverIps;
  const dirty = edited !== null && (edited.length !== serverIps.length || edited.some((ip, i) => ip !== serverIps[i]));

  const add = (e?: FormEvent) => {
    e?.preventDefault();
    const ip = value.trim();
    if (!ip) return;
    if (!IP_RE.test(ip) || !(ip.includes('.') || ip.includes(':'))) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (!ips.includes(ip)) setEdited([...ips, ip]);
    setValue('');
  };

  const remove = (ip: string) => setEdited(ips.filter((x) => x !== ip));

  const command = `railway variables --set 'IP_BLOCKLIST=${ips.join(',')}' --service pulse-plausible`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the command stays visible for manual copy */
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h3 className="lf-title flex items-center gap-2">
        <Icon name="block" className="!text-[20px] text-content-muted" />
        {t('admin.analytics.exclusions.title')}
      </h3>
      <p className="lf-caption text-content-muted">{t('admin.analytics.exclusions.caption')}</p>

      {data.state === 'error' ? (
        <p className="lf-caption text-content-faint">
          {t(`errors.api.${data.code}`, { defaultValue: t('admin.analytics.unavailableBody') })}
        </p>
      ) : data.state === 'loading' ? (
        <p className="lf-caption text-content-faint">{t('admin.loading')}</p>
      ) : (
        <>
          {ips.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {ips.map((ip) => (
                <li
                  key={ip}
                  className="lf-caption inline-flex items-center gap-1.5 rounded-full bg-surface-sunken py-1.5 pl-3 pr-1.5 font-bold text-content"
                >
                  <span className="lf-number">{ip}</span>
                  <button
                    type="button"
                    aria-label={t('admin.analytics.exclusions.remove', { ip })}
                    onClick={() => remove(ip)}
                    className="motion-safe-press flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-error-soft hover:text-error-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Icon name="close" className="!text-[14px]" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lf-caption text-content-faint">{t('admin.analytics.exclusions.empty')}</p>
          )}

          <form onSubmit={add} className="flex flex-wrap items-end gap-2">
            <Field
              label={t('admin.analytics.exclusions.valueLabel')}
              placeholder={t('admin.analytics.exclusions.valuePlaceholder')}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setInvalid(false);
              }}
              error={invalid ? t('admin.analytics.exclusions.invalid') : undefined}
              className="min-w-36 flex-1 sm:max-w-xs"
            />
            <div className="flex min-h-12 items-center">
              <AdminAction tone="primary" icon="add" onClick={() => add()}>
                {t('admin.analytics.exclusions.add')}
              </AdminAction>
            </div>
          </form>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="lf-caption font-bold text-content-muted">
                {t('admin.analytics.exclusions.commandLabel')}
              </span>
              <AdminAction tone={copied ? 'success' : 'neutral'} icon={copied ? 'check' : 'content_copy'} onClick={() => void copy()}>
                {copied ? t('admin.analytics.exclusions.copied') : t('admin.analytics.exclusions.copy')}
              </AdminAction>
            </div>
            <pre className="lf-caption overflow-x-auto rounded-md bg-surface-sunken p-3 text-content">
              <code className="lf-number">{command}</code>
            </pre>
            {dirty && <p className="lf-caption text-warning-strong">{t('admin.analytics.exclusions.pending')}</p>}
          </div>

          <p className="lf-caption text-content-faint">{t('admin.analytics.exclusions.note')}</p>
        </>
      )}
    </Card>
  );
}
