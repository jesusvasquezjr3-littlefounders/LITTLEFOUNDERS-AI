import { Button } from '@/components/ui/button';
import { useSiteCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/utils';

/*
 * The two calls to action, the same pair wherever the page asks. They render as buttons and do
 * nothing yet (T-006 in docs/process/BUILD-TASKS.md). Stacked and full width on phones.
 */
export function CtaButtons({ origin, className }: { origin: string; className?: string }) {
  const copy = useSiteCopy().landingV2;

  return <div className={cn('grid w-full max-w-sm gap-3 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap', className)}>
    <Button type="button" variant="accent" size="lg" className="w-full sm:w-auto" data-cta="become-tutor" data-origin={origin}>{copy.heroParent}</Button>
    <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" data-cta="start-free" data-origin={`${origin}-learn`}>{copy.heroLearn}</Button>
  </div>;
}
