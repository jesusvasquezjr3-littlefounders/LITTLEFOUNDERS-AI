import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon, SectionHeading } from '@/components/ui';
import { useAdminData } from '../adminShared';
import { bandOf, INSTRUMENTED_EVENTS } from './usageShared';
import type { ActivityData, AdoptionData, SessionDepthData } from './analyticsShared';

/*
 * What the product is actually used FOR, from three endpoints Core has served
 * all along and no screen had ever opened.
 *
 * On 2026-08-28 nine `/admin/insights/*` routes had no consumer anywhere in
 * the app. Three of them answer questions the dataintel console does not:
 * which surfaces get reached, which roles reach them, and how deep a session
 * goes. The rest were duplicated by the warehouse and are left alone rather
 * than shown twice — two panels answering the same question with slightly
 * different numbers is worse than one.
 *
 * THE INSTRUMENTATION CARD IS NOT A DEBUG VIEW. It lists the closed event
 * vocabulary and marks which members have never once fired. That is how
 * `signup_complete` — zero across 31 real accounts — becomes something an
 * operator SEES rather than something an engineer has to go and measure. A
 * metric that is silently absent looks exactly like a metric that is zero
 * (/AGENTS.md §1.14), and the only durable fix is to put the absence on screen.
 */

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
      <div className="h-full rounded-full bg-primary/70" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

export function ProductUsageSection({ days }: { days: number }) {
  const { t, i18n } = useTranslation();
  const nf = new Intl.NumberFormat(i18n.resolvedLanguage ?? 'en-US');

  const { data: activity } = useAdminData<ActivityData>(`/admin/insights/activity?days=${days}`);
  const { data: adoption } = useAdminData<AdoptionData>('/admin/insights/adoption');
  const { data: sessions } = useAdminData<SessionDepthData>(`/admin/insights/sessions?days=${Math.min(days, 90)}&limit=1000`);

  /** Surfaces reached, summed across the window. */
  const surfaces = useMemo(() => {
    // Shape-checked, not assumed: a partial payload must not take the page
    // down. See the same note in UsersFunnelCard.
    if (activity.state !== 'ready' || !Array.isArray(activity.data?.entries)) return [];
    const map = new Map<string, { label: string; events: number; sessions: number }>();
    for (const row of activity.data.entries) {
      // A null route_class is not a surface — `session_heartbeat` carries none
      // by design and is 61% of all rows. Counting it as "(unknown)" would
      // make the biggest bar on the chart mean nothing at all.
      if (!row.route_class) continue;
      const cur = map.get(row.route_class) ?? { label: row.route_class, events: 0, sessions: 0 };
      cur.events += row.events;
      cur.sessions += row.sessions;
      map.set(row.route_class, cur);
    }
    return [...map.values()].sort((a, b) => b.events - a.events);
  }, [activity]);

  /** Which events have fired at all, and which never have. */
  const eventHealth = useMemo(() => {
    if (activity.state !== 'ready' || !Array.isArray(activity.data?.entries)) return null;
    const seen = new Map<string, number>();
    for (const row of activity.data.entries) seen.set(row.event, (seen.get(row.event) ?? 0) + row.events);
    const firing = INSTRUMENTED_EVENTS.filter((e) => (seen.get(e) ?? 0) > 0)
      .map((e) => ({ event: e, count: seen.get(e) ?? 0 }))
      .sort((a, b) => b.count - a.count);
    const silent = INSTRUMENTED_EVENTS.filter((e) => (seen.get(e) ?? 0) === 0);
    return { firing, silent };
  }, [activity]);

  /** Session depth, as a distribution rather than a mean. */
  const depth = useMemo(() => {
    if (sessions.state !== 'ready' || !Array.isArray(sessions.data?.entries) || sessions.data.entries.length === 0) return null;
    const rows = sessions.data.entries.filter((r) => bandOf(r.role) !== 'staff');
    if (rows.length === 0) return null;
    const sorted = [...rows].sort((a, b) => a.events - b.events);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]?.events ?? 0;
    const multiSurface = rows.filter((r) => r.surfaces > 1).length;
    return {
      count: rows.length,
      median: at(0.5),
      p90: at(0.9),
      // The number that says whether anyone explores: a session that touches
      // one surface and leaves is a bounce wearing a different name.
      multiSurfaceShare: multiSurface / rows.length,
    };
  }, [sessions]);

  const maxSurface = surfaces[0]?.events ?? 0;

  return (
    <section aria-labelledby="admin-usage" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading
          icon="explore"
          tone="accent"
          id="admin-usage"
          className="mb-0 min-w-0 flex-1"
          meta={t('admin.analytics.usage.source')}
        >
          {t('admin.analytics.usage.title')}
        </SectionHeading>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Which surfaces get reached ───────────────────────── */}
        <Card className="flex flex-col gap-3 p-5 shadow-glass">
          <div className="flex flex-col">
            <SectionHeading icon="dashboard" tone="accent" as="h3" className="mb-1">
              {t('admin.analytics.usage.surfacesTitle')}
            </SectionHeading>
            <p className="lf-caption text-content-muted">{t('admin.analytics.usage.surfacesSub')}</p>
          </div>
          {surfaces.length === 0 ? (
            <p className="lf-caption text-content-muted">{t('admin.analytics.usage.noSurfaces')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {surfaces.map((s) => (
                <li key={s.label} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="lf-caption text-content">{t(`admin.analytics.usage.surfaces.${s.label}`, s.label)}</span>
                    <span className="lf-number lf-caption text-content-muted">
                      {t('admin.analytics.usage.surfaceCounts', { events: nf.format(s.events), sessions: nf.format(s.sessions) })}
                    </span>
                  </div>
                  <Bar value={s.events} max={maxSurface} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── How deep a session goes ──────────────────────────── */}
        <Card className="flex flex-col gap-3 p-5 shadow-glass">
          <div className="flex flex-col">
            <SectionHeading icon="vertical_align_bottom" tone="delight" as="h3" className="mb-1">
              {t('admin.analytics.usage.depthTitle')}
            </SectionHeading>
            <p className="lf-caption text-content-muted">{t('admin.analytics.usage.depthSub')}</p>
          </div>
          {depth === null ? (
            <p className="lf-caption text-content-muted">{t('admin.analytics.usage.noDepth')}</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="lf-number text-2xl font-semibold text-content">{nf.format(depth.median)}</p>
                <p className="lf-caption text-content-muted">{t('admin.analytics.usage.medianEvents')}</p>
              </div>
              <div>
                <p className="lf-number text-2xl font-semibold text-content">{nf.format(depth.p90)}</p>
                <p className="lf-caption text-content-muted">{t('admin.analytics.usage.p90Events')}</p>
              </div>
              <div>
                <p className="lf-number text-2xl font-semibold text-content">
                  {new Intl.NumberFormat(i18n.resolvedLanguage ?? 'en-US', { style: 'percent', maximumFractionDigits: 0 }).format(depth.multiSurfaceShare)}
                </p>
                <p className="lf-caption text-content-muted">{t('admin.analytics.usage.multiSurface')}</p>
              </div>
            </div>
          )}
          {depth !== null && (
            <p className="lf-caption text-content-muted">
              {t('admin.analytics.usage.depthNote', { count: depth.count })}
            </p>
          )}
        </Card>
      </div>

      {/* ── Instrumentation health ─────────────────────────────── */}
      {eventHealth && (
        <Card className="flex flex-col gap-3 p-5 shadow-glass">
          {/*
            An instrumentation-health card is exactly the surface where the hue
            has to be a reading: warning while any instrumented event is silent,
            success when they all report. A permanently accent-coloured tile
            here would say nothing on the one card whose whole job is to say
            whether we can see.
          */}
          <SectionHeading
            icon="sensors"
            tone={eventHealth.silent.length > 0 ? 'warning' : 'success'}
            as="h3"
            className="mb-1"
            meta={
              eventHealth.silent.length > 0 ? (
                <Badge className="bg-warning-soft text-warning-strong">
                  {t('admin.analytics.usage.silentBadge', { count: eventHealth.silent.length })}
                </Badge>
              ) : undefined
            }
          >
            {t('admin.analytics.usage.healthTitle')}
          </SectionHeading>
          <p className="lf-caption text-content-muted">{t('admin.analytics.usage.healthSub')}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <h4 className="lf-eyebrow text-content-faint">{t('admin.analytics.usage.firing')}</h4>
              <ul className="flex flex-wrap gap-1.5">
                {eventHealth.firing.map((e) => (
                  <li key={e.event}>
                    <span className="lf-caption inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-success-strong">
                      <span className="lf-number">{nf.format(e.count)}</span> {e.event}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <h4 className="lf-eyebrow text-content-faint">{t('admin.analytics.usage.silent')}</h4>
              {eventHealth.silent.length === 0 ? (
                <p className="lf-caption text-content-muted">{t('admin.analytics.usage.allFiring')}</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {eventHealth.silent.map((e) => (
                    <li key={e}>
                      <span className="lf-caption rounded-md bg-surface-sunken px-2 py-0.5 text-content-muted">{e}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="lf-caption flex items-start gap-1.5 text-content-muted">
            <Icon name="info" className="!text-[14px] shrink-0 translate-y-0.5" aria-hidden />
            {t('admin.analytics.usage.healthNote')}
          </p>
        </Card>
      )}

      {/* ── Who reaches what ───────────────────────────────────── */}
      {adoption.state === 'ready' && Array.isArray(adoption.data?.entries) && adoption.data.entries.length > 0 && (
        <Card className="flex flex-col gap-3 p-5 shadow-glass">
          <div className="flex flex-col">
            <SectionHeading icon="diversity_3" tone="delight" as="h3" className="mb-1">
              {t('admin.analytics.usage.adoptionTitle')}
            </SectionHeading>
            <p className="lf-caption text-content-muted">{t('admin.analytics.usage.adoptionSub')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left">
              <thead>
                <tr className="lf-caption text-content-faint">
                  <th className="border-b border-outline/60 py-1.5 pr-3 font-medium">{t('admin.analytics.usage.role')}</th>
                  <th className="border-b border-outline/60 py-1.5 pr-3 font-medium">{t('admin.analytics.usage.surface')}</th>
                  <th className="border-b border-outline/60 py-1.5 pr-3 text-right font-medium">{t('admin.analytics.usage.people')}</th>
                  <th className="border-b border-outline/60 py-1.5 pr-3 text-right font-medium">{t('admin.analytics.usage.sessionsCol')}</th>
                </tr>
              </thead>
              <tbody className="lf-caption text-content-muted">
                {adoption.data.entries
                  .filter((r) => r.route_class)
                  .map((r) => (
                    <tr key={`${r.role}-${r.route_class}`}>
                      <td className="border-b border-outline/40 py-1.5 pr-3 text-content">{r.role}</td>
                      <td className="border-b border-outline/40 py-1.5 pr-3">
                        {t(`admin.analytics.usage.surfaces.${r.route_class}`, r.route_class ?? '')}
                      </td>
                      <td className="lf-number border-b border-outline/40 py-1.5 pr-3 text-right">{nf.format(r.users)}</td>
                      <td className="lf-number border-b border-outline/40 py-1.5 pr-3 text-right">{nf.format(r.sessions)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
