import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';

/*
 * /DESIGN.md §Screen Recipes → Auth: 2-column split layout.
 * Desktop: text left, form right — full-viewport image behind both.
 * Mobile: single column, text then form.
 */
export function AuthSplit({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-8 px-5 py-8 md:grid-cols-2 md:px-8 md:py-0">
      <div className="flex flex-col items-start justify-center text-center md:pr-12 md:text-left">
        <h1 className="lf-display-lg">{title}</h1>
        {subtitle && <p className="lf-body-lg mt-4">{subtitle}</p>}
      </div>
      <div className="pointer-events-auto flex flex-col items-center justify-center">
        <Link
          to="/"
          className="lf-caption mb-3 inline-flex items-center gap-1 text-on-inverse transition-colors duration-150 hover:text-on-inverse/70"
        >
          <Icon name="arrow_back" className="text-sm" />
          {t('auth.backToHome')}
        </Link>
        <div className="lf-glass w-full max-w-md rounded-lg p-6 sm:p-8">
          {children}
        </div>
        {footer && (
          <p className="lf-body mt-6 text-center">
            <span className="inline-block rounded-full bg-white/10 px-4 py-2">
              {footer}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
