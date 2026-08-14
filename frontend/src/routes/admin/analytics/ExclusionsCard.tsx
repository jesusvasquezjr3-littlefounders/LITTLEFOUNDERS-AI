import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { isDeviceOptedOut, setDeviceOptOut } from '@/lib/analytics';
import { AdminAction, useAdminData, useAdminMutation } from '../adminShared';
import type { ExclusionsData } from './analyticsShared';

/*
 * Internal-traffic exclusions.
 *
 * This panel existed once before as a read-only mirror of a Plausible setting
 * that does not exist, and was removed for claiming an enforcement it did not
 * have. It is back because the enforcement is now real and ours: an excluded
 * address stops the SPA from loading any tracker and makes Core drop its
 * first-party events. Two rules keep it honest on screen:
 *
 *  1. It says plainly that exclusion starts now and does not rewrite history.
 *  2. It never renders an empty list out of a failed read. A blank panel that
 *     means "we could not check" and a blank panel that means "nothing is
 *     excluded" would look identical, and an operator would trust the wrong one.
 */

function relativeDays(iso: string, locale: string): string {
  const days = Math.round((Date.now() - Date.parse(iso)) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return Math.abs(days) >= 1 ? rtf.format(-days, 'day') : rtf.format(0, 'day');
}

export function ExclusionsCard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const { data, reload } = useAdminData<ExclusionsData>('/admin/analytics/exclusions?days=30&limit=50');
  const mutate = useAdminMutation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState({ network: '', label: '' });
  const [deviceOptedOut, setDeviceOptedOut] = useState(() => isDeviceOptedOut());

  const run = useCallback(
    async (key: string, path: string, body?: unknown, method: 'POST' | 'DELETE' = 'POST') => {
      setBusy(key);
      setError(null);
      const result = await mutate(path, body, method);
      setBusy(null);
      if (result.error) {
        setError(t(`errors.api.${result.error.code}`, { defaultValue: result.error.message }));
        return false;
      }
      await reload();
      return true;
    },
    [mutate, reload, t],
  );

  const excludeSelf = () => void run('self', '/admin/analytics/exclusions/self', { label: t('admin.analytics.exclusions.selfLabel') });
  const excludeSighting = (address: string, who: string) =>
    void run(address, '/admin/analytics/exclusions', { network: address, label: who });
  const revoke = (id: string) => void run(id, `/admin/analytics/exclusions/${id}`, undefined, 'DELETE');
  const addManual = () => {
    if (!manual.network.trim() || !manual.label.trim()) return;
    void run('manual', '/admin/analytics/exclusions', {
      network: manual.network.trim(),
      label: manual.label.trim(),
    }).then((okResult) => {
      if (okResult) setManual({ network: '', label: '' });
    });
  };

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5">
      <div>
        <h3 className="lf-title flex items-center gap-2 text-content">
          <Icon name="filter_alt_off" className="!text-[21px] text-primary" />
          {t('admin.analytics.exclusions.title')}
        </h3>
        <p className="lf-caption mt-1 text-content-muted">{t('admin.analytics.exclusions.caption')}</p>
      </div>

      {data.state === 'error' ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-outline/40 bg-surface-sunken/30 py-8 text-center">
          <Icon name="cloud_off" className="!text-[34px] text-content-faint" />
          <p className="lf-caption text-content-muted">
            {t(`errors.api.${data.code}`, { defaultValue: t('admin.analytics.exclusions.unavailable') })}
          </p>
        </div>
      ) : data.state === 'loading' ? (
        <div className="min-h-32 animate-pulse rounded-xl border border-outline/40 bg-surface-sunken/40" />
      ) : (
        <>
          {/* Your own device, and the one button that needs no knowledge at all. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline/40 bg-surface-sunken/30 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <Icon
                name={data.data.self.excluded ? 'visibility_off' : 'my_location'}
                className={cn('!text-[22px]', data.data.self.excluded ? 'text-success-strong' : 'text-primary')}
              />
              <div className="min-w-0">
                <p className="lf-caption text-content-muted">{t('admin.analytics.exclusions.yourDevice')}</p>
                <p className="lf-number truncate text-content">{data.data.self.ip ?? t('admin.analytics.exclusions.unknownAddress')}</p>
              </div>
            </div>
            {data.data.self.excluded ? (
              <Badge className="bg-success-soft text-success-strong">{t('admin.analytics.exclusions.selfExcluded')}</Badge>
            ) : (
              <AdminAction tone="primary" icon="block" onClick={excludeSelf} disabled={busy !== null || !data.data.self.ip}>
                {t('admin.analytics.exclusions.excludeSelf')}
              </AdminAction>
            )}
          </div>

          {/*
            * Device-level opt-out. Separate from the IP registry on purpose:
            * an IP exclusion is the wrong tool behind a consumer VPN, where
            * the exit address rotates (so it stops covering you) and is shared
            * (so it silently removes other people's real visits). This flag
            * lives only in this browser, affects nobody else, and no server
            * answer clears it.
            */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline/40 bg-surface-sunken/40 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <Icon
                name={deviceOptedOut ? 'phonelink_off' : 'devices'}
                className={cn('!text-[22px]', deviceOptedOut ? 'text-success-strong' : 'text-content-muted')}
              />
              <div className="min-w-0">
                <p className="lf-caption text-content-muted">{t('admin.analytics.exclusions.deviceTitle')}</p>
                <p className="lf-caption text-content-faint">{t('admin.analytics.exclusions.deviceHint')}</p>
              </div>
            </div>
            <AdminAction
              tone={deviceOptedOut ? 'neutral' : 'primary'}
              icon={deviceOptedOut ? 'visibility' : 'phonelink_off'}
              onClick={() => {
                setDeviceOptOut(!deviceOptedOut);
                setDeviceOptedOut(!deviceOptedOut);
              }}
            >
              {t(deviceOptedOut ? 'admin.analytics.exclusions.deviceResume' : 'admin.analytics.exclusions.deviceExclude')}
            </AdminAction>
          </div>

          {/* Automatic detection: addresses staff have actually worked from. */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="lf-label font-bold text-content">{t('admin.analytics.exclusions.detectedTitle')}</p>
              <span className="lf-caption text-content-faint">
                {t('admin.analytics.exclusions.detectedWindow', { days: data.data.windowDays })}
              </span>
            </div>
            {data.data.suggestions.length === 0 ? (
              <p className="lf-caption rounded-lg border border-outline/30 bg-surface-sunken/30 p-3 text-content-muted">
                {t('admin.analytics.exclusions.detectedEmpty')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.data.suggestions.map((sighting) => (
                  <li
                    key={`${sighting.address}-${sighting.userId}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline/30 bg-surface-sunken/20 p-3"
                  >
                    <div className="min-w-0">
                      <p className="lf-number truncate text-content">{sighting.address}</p>
                      <p className="lf-caption text-content-muted">
                        {t('admin.analytics.exclusions.seenBy', {
                          name: sighting.displayName,
                          count: sighting.hits,
                          when: relativeDays(sighting.lastSeenAt, locale),
                        })}
                      </p>
                    </div>
                    <AdminAction
                      tone="neutral"
                      icon="block"
                      onClick={() => excludeSighting(sighting.address, sighting.displayName)}
                      disabled={busy !== null}
                    >
                      {t('admin.analytics.exclusions.exclude')}
                    </AdminAction>
                    {sighting.distinctStaffUsers > 1 && (
                      /*
                       * Shared egress. A personal device cannot be seen with
                       * two different staff accounts; an office NAT or a VPN
                       * exit can. Excluding a VPN exit deletes every other
                       * visitor behind that same exit — silently, and without
                       * even excluding staff reliably, since exit IPs rotate.
                       * On 2026-08-14 this exact address was approved as a
                       * "team device" and turned out to be a CDN77 exit node.
                       *
                       * Warned, not blocked: an office IP is a legitimate
                       * exclusion and only the operator knows which this is.
                       */
                      <p className="lf-caption flex w-full items-start gap-1.5 rounded-lg bg-warning-soft p-2 text-warning-strong">
                        <Icon name="warning" className="!text-[16px] shrink-0" />
                        <span>
                          {t('admin.analytics.exclusions.sharedEgress', { count: sighting.distinctStaffUsers })}
                        </span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active list. */}
          <div className="flex flex-col gap-2">
            <p className="lf-label font-bold text-content">
              {t('admin.analytics.exclusions.activeTitle', { count: data.data.active.length })}
            </p>
            {data.data.active.length === 0 ? (
              <p className="lf-caption rounded-lg border border-outline/30 bg-surface-sunken/30 p-3 text-content-muted">
                {t('admin.analytics.exclusions.activeEmpty')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.data.active.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline/30 bg-surface-sunken/20 p-3"
                  >
                    <div className="min-w-0">
                      <p className="lf-number truncate text-content">{row.network}</p>
                      <p className="lf-caption truncate text-content-muted">
                        {row.label} · {relativeDays(row.created_at, locale)}
                      </p>
                    </div>
                    <AdminAction tone="danger" icon="undo" onClick={() => revoke(row.id)} disabled={busy !== null}>
                      {t('admin.analytics.exclusions.revoke')}
                    </AdminAction>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Manual entry, for an office range nobody has browsed from yet. */}
          <div className="flex flex-col gap-2 rounded-xl border border-outline/40 bg-surface-sunken/20 p-3">
            <p className="lf-label font-bold text-content">{t('admin.analytics.exclusions.manualTitle')}</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="lf-caption text-content-muted">{t('admin.analytics.exclusions.networkLabel')}</span>
                <input
                  value={manual.network}
                  onChange={(event) => setManual((m) => ({ ...m, network: event.target.value }))}
                  placeholder="203.0.113.0/24"
                  className="w-full rounded-lg border border-outline bg-surface px-3 py-2 font-mono text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="lf-caption text-content-muted">{t('admin.analytics.exclusions.nameLabel')}</span>
                <input
                  value={manual.label}
                  onChange={(event) => setManual((m) => ({ ...m, label: event.target.value }))}
                  placeholder={t('admin.analytics.exclusions.namePlaceholder')}
                  className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </label>
              <AdminAction
                tone="neutral"
                icon="add"
                onClick={addManual}
                disabled={busy !== null || !manual.network.trim() || !manual.label.trim()}
              >
                {t('admin.analytics.exclusions.add')}
              </AdminAction>
            </div>
          </div>

          <p className="lf-caption rounded-lg border border-warning/30 bg-warning-soft/40 p-3 text-warning-strong">
            {t('admin.analytics.exclusions.forwardOnly')}
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="lf-caption text-error-strong">
          {error}
        </p>
      )}
    </Card>
  );
}
