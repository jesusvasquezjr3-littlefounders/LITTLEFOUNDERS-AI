import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuthDialog } from '@/features/auth/AuthDialog';
import { useSession } from '@/features/auth/session';
import { LoopVideo } from '@/features/landing/LoopVideo';
import { onboarding, useOnboardingAnswers } from '@/features/onboarding/store';
import { useOnboardingCopy } from '@/i18n/useCopy';

/*
 * Shown to somebody who walked the onboarding and has no account yet, on the site's home page and,
 * to a guest, on the home of the application: one small line that says what they chose is kept on
 * this device, with the two things they can do about it, create the account (or finish the walk)
 * and erase it. It is small on purpose: it informs, and never competes with the page it is on.
 * Nothing shows for a visitor who never started, or for anyone signed in.
 *
 * Erasing cannot be undone and, for a guest, ends the visit. So it asks first (fail safe, rule 16 of
 * CLAUDE.md): a window says what will be lost, the button that keeps everything has the focus, and
 * closing the window any other way keeps everything too.
 */
const SMALL = '!h-11 !min-h-11 !w-auto !px-2 !text-[13px] underline underline-offset-4';

export function SavedNotice({ className = '' }: { className?: string }) {
  const copy = useOnboardingCopy().saved;
  const answers = useOnboardingAnswers();
  const { status } = useSession();
  const authDialog = useAuthDialog();
  const [isAsking, setIsAsking] = useState(false);
  const keep = useRef<HTMLButtonElement>(null);

  if (!answers || status !== 'signedOut') return null;

  const erase = () => {
    setIsAsking(false);
    onboarding.clear();
    sileo.success({ title: copy.cleared });
  };

  return <aside className={`inline-flex max-w-full flex-wrap items-center justify-center gap-x-1 rounded-[22px] bg-[var(--v-yellow-soft)] ps-4 pe-2 text-[13px] leading-snug text-[var(--v-text)] ${className}`}>
    <p className="m-0 min-w-0 py-1 font-bold text-pretty">{answers.name ? copy.text.replace('{name}', answers.name) : copy.textNoName}</p>
    <span className="flex flex-wrap items-center justify-center">
      {answers.finished
        ? <Button type="button" variant="ghost" size="sm" className={`${SMALL} font-extrabold`} onPointerEnter={authDialog.preload} onFocus={authDialog.preload} onClick={() => authDialog.open('join')}>{copy.create}</Button>
        : <Button asChild variant="ghost" size="sm" className={`${SMALL} font-extrabold`}><Link to={answers.path === 'parent' ? '/onboarding/parent' : '/onboarding'}>{copy.continue}</Link></Button>}
      <Button type="button" variant="ghost" size="sm" className={SMALL} data-erase onClick={() => setIsAsking(true)}>{copy.clear}</Button>
    </span>

    <Dialog open={isAsking} onOpenChange={setIsAsking}>
      <DialogContent role="alertdialog" className="!w-[min(420px,calc(100%-32px))] !gap-0 overflow-hidden !p-0 text-center"
        onOpenAutoFocus={(event) => {
          // the safe choice has the focus: Enter, or a careless press, keeps everything
          event.preventDefault();
          keep.current?.focus();
        }}>
        <div aria-hidden className="h-[132px] w-full [mask-image:radial-gradient(ellipse_74%_78%_at_50%_52%,#000_66%,transparent_100%)]">
          <LoopVideo name="notfound" className="size-full object-contain" />
        </div>
        <div className="grid gap-4 px-6 pb-6 pt-2">
          <DialogTitle className="!pt-0 text-balance">{answers.name ? copy.confirmTitle.replace('{name}', answers.name) : copy.confirmTitleNoName}</DialogTitle>
          <DialogDescription className="m-0 text-pretty">{copy.confirmText}</DialogDescription>
          <div className="grid gap-2">
            <Button ref={keep} type="button" fullWidth data-keep onClick={() => setIsAsking(false)}>{copy.confirmKeep}</Button>
            <Button type="button" variant="ghost" fullWidth className="!text-[color:var(--lf-error)]" data-confirm-erase onClick={erase}>{copy.confirmErase}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </aside>;
}
