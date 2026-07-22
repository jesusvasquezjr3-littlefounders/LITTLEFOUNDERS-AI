import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Dropdown, Field, Icon, type DropdownOption } from '@/components/ui';
import { AdminAction } from '../adminShared';
import { BUILDER_DIMENSIONS, countryLabel, type AnalyticsFilter, type DimensionKey } from './analyticsShared';

/*
 * Segment filter builder + active-filter chips. Filters re-query overview and
 * every breakdown with the Plausible v2 `filters` param. Values can be typed
 * here or one-click added by clicking any breakdown row — both land in the
 * same chip list. Chips wrap (flex-wrap), so the bar never scrolls sideways.
 */

export function FilterBar({
  filters,
  onAdd,
  onRemove,
}: {
  filters: AnalyticsFilter[];
  onAdd: (dimension: DimensionKey, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const [dimension, setDimension] = useState<DimensionKey>('country');
  const [value, setValue] = useState('');

  const dimensionOptions: DropdownOption<DimensionKey>[] = BUILDER_DIMENSIONS.map((d) => ({
    value: d,
    label: t(`admin.analytics.dimensions.${d}`),
  }));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const v = value.trim();
    if (!v) return;
    onAdd(dimension, v);
    setValue('');
  };

  const chipValue = (f: AnalyticsFilter) =>
    f.dimension === 'country' ? countryLabel(f.value, i18n.resolvedLanguage) : f.value;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="lf-label text-content">{t('admin.analytics.filters.dimensionLabel')}</span>
          <Dropdown
            value={dimension}
            options={dimensionOptions}
            onChange={setDimension}
            ariaLabel={t('admin.analytics.filters.dimensionLabel')}
            align="left"
          />
        </div>
        <Field
          label={t('admin.analytics.filters.valueLabel')}
          placeholder={t('admin.analytics.filters.valuePlaceholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-36 flex-1 sm:max-w-xs"
        />
        <div className="flex min-h-12 items-center">
          <AdminAction tone="primary" icon="add" onClick={() => submit()}>
            {t('admin.analytics.filters.add')}
          </AdminAction>
        </div>
      </form>

      {filters.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-2" aria-label={t('admin.analytics.filters.active')}>
          {filters.map((f, i) => {
            const label = `${t(`admin.analytics.dimensions.${f.dimension}`)}: ${chipValue(f)}`;
            return (
              <li
                key={`${f.dimension}:${f.value}`}
                className="lf-caption inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-primary-soft py-1.5 pl-3 pr-1.5 font-bold text-primary"
              >
                <span className="truncate" title={label}>
                  {label}
                </span>
                <button
                  type="button"
                  aria-label={t('admin.analytics.filters.remove', { filter: label })}
                  onClick={() => onRemove(i)}
                  className="motion-safe-press flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Icon name="close" className="!text-[14px]" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="lf-caption text-content-faint">{t('admin.analytics.filters.hint')}</p>
      )}
    </Card>
  );
}
