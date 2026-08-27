import { useTranslation } from 'react-i18next';
import { Card, Icon } from '@/components/ui';

/*
 * `/dev/analytics-notices` — the provenance notices, rendered without an
 * admin session.
 *
 * These three notices only appear when the analytics API reports something
 * unusual: a window mismatch, or a breakdown that excludes imported history.
 * That makes them the hardest part of /admin/analytics to look at, and they
 * are the part where being wrong is most expensive — each one exists to stop
 * a reader inventing an explanation for a number that surprised them.
 *
 * They exist at all because an outside reviewer read three of our exports on
 * 2026-08-25 and reported two tracking failures that had never happened. The
 * data to contradict both was in the analytics API's response and reached
 * neither the screen nor the file (WALKTHROUGH, 2026-08-27).
 *
 * DEV-only, like the other labs in App.tsx: no route, bundle or byte of this
 * reaches production.
 */
export default function AnalyticsNoticesLab() {
  const { t } = useTranslation();

  const drift = {
    asked: '2026-03-01 – 2026-08-27',
    answered: '2026-02-01 – 2026-07-31',
  };

  return (
    <main className="mx-auto flex w-full max-w-[var(--lf-container-max,72rem)] flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="lf-headline font-bold text-content">Analytics provenance notices</h1>
        <p className="lf-caption text-content-muted">
          Dev harness — the three states /admin/analytics only shows when the upstream reports a problem.
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-label="Range drift">
        <h2 className="lf-title text-content">1 — Window mismatch</h2>
        <p className="lf-caption text-content-muted">
          Normally impossible: the server sends resolved dates and Plausible echoes them back. Shown when it does not.
        </p>
        {/* Same shape as UnavailableCard, inlined so the lab needs no admin data layer. */}
        <Card className="flex flex-col items-center gap-2 py-8 text-center shadow-glass border border-outline/50">
          <Icon name="cloud_off" className="!text-[28px] text-content-faint" />
          <p className="lf-title text-content">{t('admin.analytics.rangeDrift.title')}</p>
          <p className="lf-caption max-w-prose text-content-muted">
            {t('admin.analytics.rangeDrift.body', drift)}
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-label="Native-only KPIs">
        <h2 className="lf-title text-content">2 — KPI caveat</h2>
        <p className="lf-caption text-content-muted">Sits under the four KPI cards.</p>
        <p className="lf-caption -mt-1 text-content-faint">{t('admin.analytics.web.nativeOnlyMetrics')}</p>
      </section>

      <section className="flex flex-col gap-3" aria-label="Native-only breakdown">
        <h2 className="lf-title text-content">3 — Breakdown caveat</h2>
        <p className="lf-caption text-content-muted">
          Sits with the table it qualifies, so the shortfall is explained where it is seen.
        </p>
        <p className="lf-caption flex items-start gap-1.5 text-content-muted">
          <Icon name="info" className="!text-[14px] shrink-0 translate-y-0.5" aria-hidden />
          {t('admin.analytics.breakdowns.nativeOnly')}
        </p>
      </section>
    </main>
  );
}
