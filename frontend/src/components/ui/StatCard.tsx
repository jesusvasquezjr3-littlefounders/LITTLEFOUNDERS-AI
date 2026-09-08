import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { IconChip } from '@/components/ui/IconChip';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Components — StatCard: icon chip, display-lg tabular number,
 * caption label.
 *
 * `shadow-tactile` and NOT `.lf-tactile`. §Tactile's table splits on whether
 * the thing is an object you PRESS: a stat tile is an object lying on a
 * surface — it wants the side, it wants the weight, and it has nothing to do
 * when you push it. `.lf-tactile` would hand it a press animation for an
 * interaction that does not exist, which reads as a control that swallowed
 * the tap. The ridge utility exists for exactly this case.
 *
 * Photographed against the real app on 2026-09-05: six of these on /profile
 * were the flattest thing on a page where everything else had gained weight.
 */

interface StatCardProps {
  icon: ReactNode;
  value: string;
  label: string;
  /** The full IconChip tone set — StatCard is a thin frame around it, so anything IconChip can key (e.g. `success`/`delight` for a semantic 3-way split) is fair game here too. */
  tone?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'delight';
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
    /*
     * STACKED BELOW `sm`, HORIZONTAL ABOVE IT.
     *
     * Photographed on a real /profile at 390px: six of these in a 2-column
     * grid left about 55px for the label after the card's padding and the
     * icon chip, so every one of them truncated — "Day st…", "Lesso…",
     * "XP po…", "Minut…". A stat whose label is cut is a number with no unit.
     *
     * Fixed HERE and not at the call site, because every caller lays these out
     * in a grid and would each have to rediscover the same arithmetic. Above
     * `sm` the row has the width for the horizontal reading, which is the
     * denser and better one.
     */
    <Card className={cn('flex flex-col items-start gap-2 text-left shadow-tactile sm:flex-row sm:items-center', dense ? 'p-4 sm:gap-3' : 'p-4 sm:gap-4 sm:p-5', className)}>
      <IconChip tone={tone} size={dense ? 'md' : 'lg'} className="shrink-0 relative overflow-visible">
        {icon}
      </IconChip>
      <div className="flex w-full min-w-0 flex-col">
        <p className={cn('lf-number leading-none truncate', dense ? 'lf-headline' : 'lf-display-lg')}>{value}</p>
        <p className="lf-caption text-content-muted mt-1 truncate">{label}</p>
      </div>
    </Card>
  );
}
