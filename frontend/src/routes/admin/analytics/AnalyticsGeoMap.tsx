import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAdminData } from '../adminShared';
import { countryLabel, type BreakdownData, type DimensionKey, type Period } from './analyticsShared';

/*
 * The map is intentionally dependency-free. Plausible gives us ISO-3166 alpha-2
 * country codes; the map renders a quiet continent silhouette plus proportional
 * country points, so the visual remains honest when a country has no traffic or
 * when a new country appears in the upstream response.
 */
const COUNTRY_POINTS: Record<string, { x: number; y: number }> = {
  CA: { x: 176, y: 103 }, US: { x: 205, y: 165 }, MX: { x: 218, y: 223 }, GT: { x: 246, y: 250 },
  BR: { x: 333, y: 323 }, AR: { x: 303, y: 392 }, CL: { x: 275, y: 382 }, CO: { x: 286, y: 280 }, PE: { x: 278, y: 319 },
  GB: { x: 458, y: 152 }, IE: { x: 443, y: 158 }, ES: { x: 472, y: 215 }, PT: { x: 459, y: 215 }, FR: { x: 492, y: 189 },
  DE: { x: 516, y: 169 }, IT: { x: 523, y: 225 }, NL: { x: 505, y: 157 }, SE: { x: 530, y: 97 }, NO: { x: 500, y: 83 },
  PL: { x: 553, y: 163 }, UA: { x: 602, y: 178 }, RU: { x: 667, y: 112 }, TR: { x: 584, y: 237 },
  MA: { x: 472, y: 247 }, NG: { x: 503, y: 312 }, GH: { x: 488, y: 321 }, ZA: { x: 542, y: 402 }, EG: { x: 557, y: 268 },
  IN: { x: 685, y: 286 }, PK: { x: 654, y: 256 }, BD: { x: 732, y: 286 }, CN: { x: 757, y: 225 }, JP: { x: 858, y: 231 },
  KR: { x: 827, y: 224 }, TH: { x: 747, y: 319 }, ID: { x: 780, y: 367 }, PH: { x: 836, y: 319 }, AU: { x: 816, y: 420 }, NZ: { x: 887, y: 444 },
};

const CONTINENTS = [
  'M91 82 L139 45 L219 54 L274 86 L285 136 L258 171 L274 216 L247 247 L208 229 L193 194 L148 181 L118 143 L74 128 Z',
  'M284 263 L324 249 L363 276 L374 328 L349 365 L324 428 L293 408 L302 358 L275 315 Z',
  'M435 151 L468 126 L513 139 L537 174 L568 163 L619 177 L653 207 L635 240 L588 245 L566 277 L528 264 L507 232 L466 226 L445 194 Z',
  'M485 269 L536 266 L566 294 L557 348 L530 403 L485 389 L468 349 Z',
  'M617 104 L690 69 L774 83 L831 123 L880 177 L852 218 L814 239 L782 222 L745 249 L701 230 L671 199 L620 182 Z',
  'M680 272 L729 264 L777 294 L795 339 L764 368 L719 347 L700 312 Z',
  'M780 373 L838 369 L879 402 L867 445 L810 439 L779 415 Z',
];

export function AnalyticsGeoMap({ period, filterQuery, onFilter }: { period: Period; filterQuery: string; onFilter: (dimension: DimensionKey, value: string) => void }) {
  const { t, i18n } = useTranslation();
  const { data } = useAdminData<BreakdownData>(`/admin/analytics/breakdown?period=${period}&dimension=country&limit=50${filterQuery}`);
  const [selected, setSelected] = useState<string | null>(null);

  if (data.state === 'loading') {
    return <MapShell title={t('admin.analytics.geo.title')} subtitle={t('admin.analytics.geo.subtitle')}><MapState icon="progress_activity" text={t('admin.loading')} spin /></MapShell>;
  }
  if (data.state === 'error') {
    return <MapShell title={t('admin.analytics.geo.title')} subtitle={t('admin.analytics.geo.subtitle')}><MapState icon="cloud_off" text={t(`errors.api.${data.code}`, { defaultValue: t('admin.analytics.unavailableBody') })} /></MapShell>;
  }

  const rows = data.data.rows;
  if (rows.length === 0) {
    return <MapShell title={t('admin.analytics.geo.title')} subtitle={t('admin.analytics.geo.subtitle')}><MapState icon="public" text={t('admin.analytics.breakdowns.empty')} /></MapShell>;
  }

  const max = Math.max(...rows.map((row) => row.visitors), 1);
  const total = rows.reduce((sum, row) => sum + row.visitors, 0);
  const numberFormat = new Intl.NumberFormat(i18n.resolvedLanguage);
  const percentFormat = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 1 });
  const selectedRow = rows.find((row) => row.label === selected);
  const selectCountry = (label: string) => {
    setSelected(label);
    onFilter('country', label);
  };

  return (
    <MapShell title={t('admin.analytics.geo.title')} subtitle={t('admin.analytics.geo.subtitle')}>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <div className="min-w-0 rounded-xl border border-outline/40 bg-surface-sunken/30 p-2 sm:p-3">
          <div className="relative aspect-[2/1] min-h-56 w-full overflow-hidden rounded-lg bg-base/20">
            <svg viewBox="0 0 960 480" className="h-full w-full" role="img" aria-label={t('admin.analytics.geo.mapAria')}>
              <title>{t('admin.analytics.geo.mapAria')}</title>
              <g className="text-content-faint">
                {CONTINENTS.map((path) => <path key={path} d={path} fill="rgb(var(--lf-surface-sunken))" stroke="rgb(var(--lf-outline))" strokeWidth="1.5" strokeLinejoin="round" />)}
              </g>
              {rows.map((row) => {
                const point = COUNTRY_POINTS[row.label.toUpperCase()];
                if (!point) return null;
                const intensity = row.visitors / max;
                const radius = 5 + intensity * 12;
                const label = countryLabel(row.label, i18n.resolvedLanguage);
                return (
                  <g key={row.label}>
                    <circle cx={point.x} cy={point.y} r={radius + 5} fill="rgb(var(--lf-primary))" opacity={0.08 + intensity * 0.12} />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={radius}
                      fill="rgb(var(--lf-primary))"
                      opacity={0.3 + intensity * 0.7}
                      stroke="rgb(var(--lf-surface))"
                      strokeWidth="2"
                      role="button"
                      tabIndex={0}
                      aria-label={`${label}: ${numberFormat.format(row.visitors)}`}
                      onClick={() => selectCountry(row.label)}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCountry(row.label); } }}
                      className="cursor-pointer outline-none focus-visible:stroke-[3px]"
                    />
                  </g>
                );
              })}
            </svg>
            <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-outline/40 bg-surface/85 px-3 py-1.5 backdrop-blur-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="lf-caption text-content-muted">{t('admin.analytics.geo.moreVisitors')}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="lf-caption text-content-faint">{t('admin.analytics.geo.low')}</span>
            <div className="h-2 min-w-24 flex-1 rounded-full bg-gradient-to-r from-primary/15 via-primary/50 to-primary" aria-hidden="true" />
            <span className="lf-caption text-content-faint">{t('admin.analytics.geo.high')}</span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="lf-label font-bold text-content">{t('admin.analytics.geo.topCountries')}</p>
              <p className="lf-caption mt-1 text-content-faint"><span className="lf-number text-content-muted">{numberFormat.format(total)}</span> {t('admin.analytics.geo.totalVisitorsLabel')}</p>
            </div>
            <Icon name="sort" className="!text-[20px] text-content-faint" />
          </div>
          <ol className="mt-3 flex flex-col gap-2">
            {rows.slice(0, 7).map((row, index) => {
              const share = total > 0 ? row.visitors / total : 0;
              const label = countryLabel(row.label, i18n.resolvedLanguage);
              return (
                <li key={row.label}>
                  <button type="button" onClick={() => selectCountry(row.label)} className={cn('group flex w-full min-w-0 flex-col gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', selectedRow?.label === row.label ? 'border-primary/60 bg-primary-soft/40' : 'border-outline/30 bg-surface-sunken/30 hover:border-outline hover:bg-surface-sunken/60')}>
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="lf-number w-5 text-content-faint">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-content" title={label}>{label}</span>
                      <span className="lf-number text-content">{numberFormat.format(row.visitors)}</span>
                    </span>
                    <span className="ml-8 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-outline/30"><span className="block h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(share * 100, 2)}%` }} /></span>
                      <span className="lf-caption w-12 text-right text-content-muted">{percentFormat.format(share)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="lf-caption mt-3 text-content-faint">{t('admin.analytics.geo.filterHint')}</p>
        </div>
      </div>
    </MapShell>
  );
}

function MapShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
      <div>
        <h3 className="lf-title flex items-center gap-2 text-content"><Icon name="public" className="!text-[21px] text-primary" />{title}</h3>
        <p className="lf-caption mt-1 text-content-muted">{subtitle}</p>
      </div>
      {children}
    </Card>
  );
}

function MapState({ icon, text, spin = false }: { icon: string; text: string; spin?: boolean }) {
  return <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-outline/30 bg-surface-sunken/30 text-center"><Icon name={icon} className={cn('!text-[38px] text-content-faint', spin && 'animate-spin')} /><p className="lf-caption text-content-muted">{text}</p></div>;
}
