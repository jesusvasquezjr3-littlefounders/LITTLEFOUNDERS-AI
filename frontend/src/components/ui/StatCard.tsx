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
  className?: string;
}

export function StatCard({ icon, value, label, tone = 'primary', className }: StatCardProps) {
  return (
    <Card className={cn('flex flex-row items-center gap-4 text-left p-4 sm:p-5', className)}>
      <IconChip tone={tone} size="lg" className="shrink-0 relative overflow-visible">
        {icon}
      </IconChip>
      <div className="flex flex-col min-w-0">
        <p className="lf-display-lg lf-number leading-none truncate">{value}</p>
        <p className="lf-caption text-content-muted mt-1 truncate">{label}</p>
      </div>
    </Card>
  );
}
