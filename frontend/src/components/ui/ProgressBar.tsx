import { cn } from '@/lib/utils';

/* /DESIGN.md §Components — ProgressBar: pill track (sunken), primary/accent fill. */

interface ProgressBarProps {
  value: number; // 0..100
  tone?: 'primary' | 'accent';
  label: string; // accessible name (i18n'd by caller)
  className?: string;
}

export function ProgressBar({ value, tone = 'primary', label, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full rounded-full bg-surface-sunken shadow-clay-sunken', className)}
    >
      <div
        className={cn('h-full rounded-full', tone === 'accent' ? 'bg-accent' : 'bg-primary')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
