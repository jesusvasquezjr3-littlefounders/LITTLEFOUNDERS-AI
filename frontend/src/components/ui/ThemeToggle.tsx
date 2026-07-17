import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeChoice } from '@/theme/useTheme';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/* /DESIGN.md §Components — ThemeToggle: 3-way segmented pill (auto/light/dark). */

const SEGMENTS: { choice: ThemeChoice; icon: string }[] = [
  { choice: 'auto', icon: 'brightness_auto' },
  { choice: 'light', icon: 'light_mode' },
  { choice: 'dark', icon: 'dark_mode' },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { choice, setChoice } = useTheme();

  return (
    <div
      role="group"
      aria-label={t('theme.toggle')}
      className={cn('inline-flex items-center gap-1 rounded-full bg-surface-sunken p-1', className)}
    >
      {SEGMENTS.map(({ choice: segment, icon }) => (
        <button
          key={segment}
          type="button"
          aria-label={t(`theme.${segment}`)}
          aria-pressed={choice === segment}
          onClick={() => setChoice(segment)}
          className={cn(
            'motion-safe-press flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            choice === segment
              ? 'bg-primary text-on-primary shadow-glass-sm'
              : 'text-content-muted hover:text-primary',
          )}
        >
          <Icon name={icon} className="text-lg" />
        </button>
      ))}
    </div>
  );
}
