import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, Icon, type DropdownOption } from '@/components/ui';
import { cn } from '@/lib/utils';
import { DateField } from './DateField';
import { PERIODS, todayIso, type Period, type PeriodSelection } from './analyticsShared';

/*
 * Window picker. The presets are Plausible's own, so the console and
 * Plausible's dashboard agree on what "this month" means; the custom range is
 * the escape hatch for the question a preset cannot answer ("how did the week
 * of the launch actually go?").
 *
 * A custom range only takes effect once BOTH ends are set: applying a
 * half-finished range would silently show a window nobody chose.
 */
export function PeriodPicker({
  selection,
  onChange,
}: {
  selection: PeriodSelection;
  onChange: (selection: PeriodSelection) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<{ from: string; to: string }>({
    from: selection.from ?? todayIso(),
    to: selection.to ?? todayIso(),
  });
  const [open, setOpen] = useState(selection.period === 'custom');

  const options: DropdownOption<Period>[] = [
    ...PERIODS.map((period) => ({ value: period, label: t(`admin.analytics.periods.${period}`) })),
    { value: 'custom' as Period, label: t('admin.analytics.periods.custom') },
  ];

  const choose = (period: Period): void => {
    if (period === 'custom') {
      setOpen(true);
      // Do not apply yet — wait for the operator to confirm two real dates.
      if (selection.from && selection.to) onChange({ period: 'custom', from: selection.from, to: selection.to });
      return;
    }
    setOpen(false);
    onChange({ period });
  };

  const applyCustom = (): void => {
    if (!draft.from || !draft.to) return;
    const [from, to] = draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from];
    onChange({ period: 'custom', from, to });
  };

  const invalid = draft.from > draft.to;

  return (
    <div className="flex flex-col gap-2">
      <Dropdown
        value={selection.period}
        options={options}
        onChange={choose}
        ariaLabel={t('admin.analytics.periodLabel')}
      />

      {open && (
        <div className="flex flex-col gap-2 rounded-xl border border-outline/50 bg-surface-sunken/40 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <DateField
              label={t('admin.analytics.customFrom')}
              value={draft.from}
              max={todayIso()}
              onChange={(from) => setDraft((d) => ({ ...d, from }))}
            />
            <DateField
              label={t('admin.analytics.customTo')}
              value={draft.to}
              max={todayIso()}
              onChange={(to) => setDraft((d) => ({ ...d, to }))}
            />
            <button
              type="button"
              onClick={applyCustom}
              disabled={invalid}
              className={cn(
                'lf-tactile inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 font-bold transition-colors',
                invalid
                  ? 'cursor-not-allowed bg-surface-sunken text-content-faint'
                  : 'bg-accent text-on-accent hover:bg-accent-strong',
              )}
            >
              <Icon name="check" className="!text-[18px]" />
              {t('admin.analytics.customApply')}
            </button>
          </div>
          {invalid && (
            <p role="alert" className="lf-caption text-error-strong">
              {t('admin.analytics.customInvalid')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
