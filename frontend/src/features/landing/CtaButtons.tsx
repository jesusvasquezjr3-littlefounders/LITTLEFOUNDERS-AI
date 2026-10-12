import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { KeepLearningButton, useHasSession } from '@/features/app/KeepLearning';
import { useSession } from '@/features/auth/session';
import { useSiteCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/utils';

/*
 * The two calls to action, the same pair wherever the page asks. Each starts the onboarding on its
 * own path: a parent's, or a learner's (docs/features/F-003-onboarding.md). Stacked and full width
 * on phones.
 *
 * Somebody who is already signed in is not asked to start: the pair gives way to the one green
 * button every call to action of the site becomes for them (KeepLearning.tsx). While the session is still being asked for, the pair keeps its
 * place but is not shown, so the buttons do not change under a pointer.
 */
export function CtaButtons({ origin, className }: { origin: string; className?: string }) {
  const copy = useSiteCopy().landingV2;
  const { status } = useSession();
  const hasSession = useHasSession();

  if (hasSession) return <div className={cn('grid w-full max-w-sm sm:flex sm:w-auto sm:max-w-none', className)}><KeepLearningButton origin={origin} className="w-full sm:w-auto" /></div>;

  return <div className={cn('grid w-full max-w-sm gap-3 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap', status === 'loading' && 'invisible', className)}>
    <Button asChild variant="accent" size="lg" className="w-full sm:w-auto"><Link to="/onboarding/parent" data-cta="start-parent" data-origin={origin}>{copy.heroParent}</Link></Button>
    <Button asChild variant="outline" size="lg" className="w-full sm:w-auto"><Link to="/onboarding" data-cta="start-learner" data-origin={`${origin}-learn`}>{copy.heroLearn}</Link></Button>
  </div>;
}
