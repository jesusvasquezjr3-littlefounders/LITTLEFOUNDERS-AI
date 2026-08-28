import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AudienceSeriesPoint } from './analyticsShared';

/*
 * Daily sessions on the platform, split by who was here.
 *
 * WHY THREE BANDS AND NOT SEVEN ROLES
 *
 * The question this chart exists to answer is "was anyone here who was not
 * us", and on a pre-launch product staff are ~90% of all event volume
 * (measured 2026-08-28: 3,963 staff events against 275 anonymous and 179
 * registered). Drawn as seven roles the answer is invisible — every real line
 * flattens into the axis under the staff bar. Three bands keep it readable and
 * keep the staff share honestly on screen rather than silently filtered out,
 * which would be the other way to get a flattering chart.
 *
 * COLOUR IS FROM THE DESIGN SYSTEM, AND CHECKED
 *
 * `primary` / `success` / `warning`, in that order. The pairing was validated
 * for colour-vision separation rather than eyeballed — the obvious choice of
 * two brand hues (indigo + violet) fails at ΔE 11.4 even for NORMAL vision,
 * which is why it is not used here. The surviving trio sits in the 6-8 CVD
 * band, which is legal only with a secondary encoding, so identity is also
 * carried by the legend, the ordered stack and the table view below. Never
 * carry identity by colour alone here.
 *
 * The semantics and the palette happen to agree, which is why status hues are
 * acceptable as categories in this one case: anonymous is the brand colour
 * because those are the visitors we want, registered is `success` because that
 * IS the conversion, and staff is `warning` because it is the band a reader
 * must discount.
 */

const BANDS = [
  { key: 'anonymous', token: 'rgb(var(--lf-primary))' },
  { key: 'registered', token: 'rgb(var(--lf-success))' },
  { key: 'staff', token: 'rgb(var(--lf-warning))' },
] as const;

export function AudienceChart({ series }: { series: AudienceSeriesPoint[] }) {
  const { t, i18n } = useTranslation();
  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);

  /*
   * Staff are IN by default, and the toggle is opt-out rather than opt-in.
   *
   * Which way round this defaults is the whole ethics of the control. Staff
   * are ~90% of volume on a pre-launch product, so a chart that hides them by
   * default is a chart that flatters — an operator would read a real audience
   * that does not exist. But left permanently in, they dwarf the two bands the
   * chart is actually FOR: at the production scale this was built against, 75
   * staff sessions on one day render four anonymous ones as a sliver.
   *
   * So: the honest number is what loads, and looking closer is one click that
   * says out loud what it removed.
   */
  const [includeStaff, setIncludeStaff] = useState(true);

  const label = (key: string) => t(`admin.analytics.audience.bands.${key}`);
  const bands = includeStaff ? BANDS : BANDS.filter((b) => b.key !== 'staff');
  const empty = series.every(
    (p) => p.anonymous + p.registered + (includeStaff ? p.staff : 0) === 0,
  );

  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-fit cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={includeStaff}
          onChange={(e) => setIncludeStaff(e.target.checked)}
          className="size-4 accent-[rgb(var(--lf-primary))]"
        />
        <span className="lf-caption text-content-muted">{t('admin.analytics.audience.includeStaff')}</span>
      </label>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="rgb(var(--lf-outline))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'rgb(var(--lf-content-faint))' }}
              tickFormatter={(d: string) => d.slice(5)}
              tickLine={false}
              axisLine={{ stroke: 'rgb(var(--lf-outline))' }}
              minTickGap={18}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'rgb(var(--lf-content-faint))' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={38}
            />
            <Tooltip
              cursor={{ fill: 'rgb(var(--lf-outline))', fillOpacity: 0.35 }}
              contentStyle={{
                background: 'rgb(var(--lf-surface))',
                border: '1px solid rgb(var(--lf-outline))',
                borderRadius: 10,
                fontSize: 12,
              }}
              labelStyle={{ color: 'rgb(var(--lf-content))', fontWeight: 600 }}
              formatter={(value: number, name: string) => [nf.format(value), label(name)]}
            />
            <Legend
              verticalAlign="top"
              align="left"
              height={28}
              iconType="circle"
              iconSize={9}
              formatter={(name: string) => (
                <span className="lf-caption text-content-muted">{label(name)}</span>
              )}
            />
            {/*
              `stackId` shared across all three, and 2px of radius only on the
              topmost band so the stack reads as one column rather than three
              stickers. isAnimationActive off: this is a console instrument, and
              a bar that grows on every poll makes a value harder to read, not
              easier.
            */}
            {bands.map((band, index) => (
              <Bar
                key={band.key}
                dataKey={band.key}
                stackId="audience"
                fill={band.token}
                isAnimationActive={false}
                radius={index === bands.length - 1 ? [3, 3, 0, 0] : undefined}
                maxBarSize={26}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/*
        An empty window says so in words. A chart of flat zeros and a chart of
        "we could not read the data" look identical, and the console has been
        wrong in exactly that way before (/AGENTS.md §1.14).
      */}
      {empty && <p className="lf-caption text-content-muted">{t('admin.analytics.audience.emptyWindow')}</p>}

      {/* Says what was removed, so a smaller chart can never be mistaken for a
          smaller reality. */}
      {!includeStaff && (
        <p className="lf-caption text-warning-strong">{t('admin.analytics.audience.staffHidden')}</p>
      )}

      {/*
        The table is not an extra: the colour trio sits in the 6-8 CVD band,
        where identity may not rest on colour alone.
      */}
      <details>
        <summary className="lf-caption cursor-pointer text-primary">
          {t('admin.analytics.audience.showTable')}
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[380px] border-collapse text-left">
            <thead>
              <tr className="lf-caption text-content-faint">
                <th className="border-b border-outline/60 py-1.5 pr-3 font-medium">
                  {t('admin.analytics.audience.day')}
                </th>
                {BANDS.map((b) => (
                  <th key={b.key} className="border-b border-outline/60 py-1.5 pr-3 text-right font-medium">
                    {label(b.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="lf-caption text-content-muted">
              {series
                .filter((p) => p.anonymous + p.registered + p.staff > 0)
                .map((p) => (
                  <tr key={p.date}>
                    <td className="border-b border-outline/40 py-1.5 pr-3">{p.date}</td>
                    <td className="lf-number border-b border-outline/40 py-1.5 pr-3 text-right">{nf.format(p.anonymous)}</td>
                    <td className="lf-number border-b border-outline/40 py-1.5 pr-3 text-right">{nf.format(p.registered)}</td>
                    <td className="lf-number border-b border-outline/40 py-1.5 pr-3 text-right">{nf.format(p.staff)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
