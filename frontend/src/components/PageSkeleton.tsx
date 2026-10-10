import { Skeleton } from '@/components/ui/skeleton';
import { grid, section } from '@/features/landing/type';
import { useCoreCopy } from '@/i18n/useCopy';

/*
 * What shows inside the shell while a page's code loads: the shape of a page (a heading, a few lines,
 * two buttons and a picture on the page grid), shimmering. It replaces a spinner because the layout
 * is already in place when the page arrives, so nothing jumps. The shimmer stops for reduced motion
 * (Cojeev's Skeleton checks it). Announced once as "Loading" and nothing else.
 */
export function PageSkeleton() {
  const label = useCoreCopy().appShell.loading;

  return <div role="status" aria-label={label} className={`${grid} items-center gap-y-10 ${section}`}>
    <div className="col-span-4 grid min-w-0 content-center justify-items-center gap-6 md:col-span-8 md:justify-items-start lg:col-span-6">
      <Skeleton className="h-12 w-full max-w-md" />
      <Skeleton className="h-12 w-4/5 max-w-sm" />
      <Skeleton variant="line" className="w-full max-w-lg" />
      <Skeleton variant="line" className="w-3/4 max-w-md" />
      <div className="flex gap-3">
        <Skeleton className="h-14 w-40" />
        <Skeleton className="h-14 w-32" />
      </div>
    </div>
    <Skeleton variant="card" className="col-span-4 aspect-[5/4] w-full max-w-xl md:col-span-8 lg:col-span-6" />
  </div>;
}
