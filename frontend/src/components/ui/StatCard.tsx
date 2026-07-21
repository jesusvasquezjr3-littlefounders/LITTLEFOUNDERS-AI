import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { IconChip } from '@/components/ui/IconChip';
import { cn } from '@/lib/utils';

/* /DESIGN.md §Components — StatCard: icon chip, display-lg tabular number, caption label. */

interface StatCardProps {
  icon: ReactNode;
  value: string;
  label: string;
  tone?: 'primary' | 'secondary' | 'accent';
  /**
   * Console-density variant (/DESIGN.md §Screen Recipes → Console): the
   * 6-col KPI track leaves ~70-100px for the numeral, where `lf-display-lg`
   * truncates anything past ~3 chars. Dense drops one step in the closed
   * scale (`lf-headline`) and tightens the chip — never an ad-hoc size.
   */
  dense?: boolean;
  className?: string;
}

export function StatCard({ icon, value, label, tone = 'primary', dense = false, className }: StatCardProps) {
  return (
    <Card className={cn('flex flex-row items-center text-left', dense ? 'gap-3 p-4' : 'gap-4 p-4 sm:p-5', className)}>
      <IconChip tone={tone} size={dense ? 'md' : 'lg'} className="shrink-0 relative overflow-visible">
        {icon}
      </IconChip>
      <div className="flex flex-col min-w-0">
        <p className={cn('lf-number leading-none truncate', dense ? 'lf-headline' : 'lf-display-lg')}>{value}</p>
        <p className="lf-caption text-content-muted mt-1 truncate">{label}</p>
      </div>
    </Card>
  );
}
