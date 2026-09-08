import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

/*
 * A destructive one-click action (cancel a task, deny a request, archive a
 * goal) becomes a two-step inline confirm — this product has never used a
 * true modal (/DESIGN.md), so the confirm step replaces the button in place
 * rather than layering a dialog on top of it. Confirming moves keyboard
 * focus to "Yes" so a keyboard user never loses their place.
 */
export function ConfirmButton({
  children,
  confirmQuestion,
  variant = 'secondary',
  className,
  disabled,
  onConfirm,
}: {
  children: ReactNode;
  confirmQuestion?: string;
  variant?: 'secondary' | 'danger';
  className?: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const yesRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) yesRef.current?.focus();
  }, [confirming]);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="lf-caption text-content-muted">{confirmQuestion ?? t('actions.confirmQuestion')}</span>
        <button
          ref={yesRef}
          type="button"
          className="lf-caption lf-press min-h-8 rounded-full bg-error px-2.5 py-1 font-bold text-on-error"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
        >
          {t('actions.confirmYes')}
        </button>
        <button
          type="button"
          className="lf-caption lf-press min-h-8 rounded-full border border-outline px-2.5 py-1 font-bold text-content-muted"
          onClick={() => setConfirming(false)}
        >
          {t('actions.confirmNo')}
        </button>
      </span>
    );
  }

  return (
    <Button type="button" variant={variant} className={className} disabled={disabled} onClick={() => setConfirming(true)}>
      {children}
    </Button>
  );
}
