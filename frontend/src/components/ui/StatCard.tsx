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
    <Card className={cn('flex flex-col items-center gap-3 text-center', className)}>
      <IconChip tone={tone}>{icon}</IconChip>
      <div>
        <p className="lf-display-lg lf-number">{value}</p>
        <p className="lf-caption text-content-muted">{label}</p>
      </div>
    </Card>
  );
}
