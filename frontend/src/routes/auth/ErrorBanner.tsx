import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';

/**
 * Inline API-error banner — code resolves through errors.api.<code>.
 *
 * The glyph sits in the study's icon well (`.lf-tile`, /DESIGN.md §The study's
 * component set) rather than floating loose beside the sentence: the tile takes
 * its fill and its border from `currentColor`, so naming the error hue once
 * colours all three matched steps and this banner reads as the same object as
 * every other tinted row in the recomposed auth surface.
 */
export function ErrorBanner({ code }: { code: string }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-error/40 bg-error-soft px-4 py-3"
    >
      <span className="lf-tile h-8 w-8 text-error-strong">
        <Icon name="error" aria-hidden className="!text-[18px]" />
      </span>
      <p className="lf-body pt-1 text-content">
        {t(`errors.api.${code}`, { defaultValue: t('errors.api.INTERNAL') })}
      </p>
    </div>
  );
}
