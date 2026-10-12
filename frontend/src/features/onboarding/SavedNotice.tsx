import { Link } from 'react-router-dom';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { useAuthDialog } from '@/features/auth/AuthDialog';
import { useSession } from '@/features/auth/session';
import { onboarding, useOnboardingAnswers } from '@/features/onboarding/store';
import { useOnboardingCopy } from '@/i18n/useCopy';

/*
 * Shown on the site's home page, and inside the application to a guest, to somebody who walked the
 * onboarding and has no account yet: it says
 * that what they chose is kept on this device, and offers the two things they can do about it,
 * finish (or create the account) and erase it. Erasing is always one press away, because the
 * device may be shared. Nothing shows for a visitor who never started, or for anyone signed in.
 */
export function SavedNotice({ compact = false }: { compact?: boolean }) {
  const copy = useOnboardingCopy().saved;
  const answers = useOnboardingAnswers();
  const { status } = useSession();
  const authDialog = useAuthDialog();

  if (!answers || status !== 'signedOut') return null;

  const erase = () => {
    onboarding.clear();
    sileo.success({ title: copy.cleared });
  };

  // `compact`, inside the application: one slim row, so the pile of the home stays the first thing on a phone
  return <aside className={compact
    ? 'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[20px] bg-[var(--v-yellow-soft)] px-4 py-2 text-start text-[var(--v-text)]'
    : 'mt-4 mb-2 grid justify-items-center gap-3 rounded-[20px] bg-[var(--v-yellow-soft)] p-4 text-center text-[var(--v-text)] md:flex md:flex-wrap md:items-center md:justify-between md:text-start'}>
    <p className={compact ? 'm-0 min-w-0 flex-1 basis-48 text-sm leading-snug font-bold text-pretty' : 'm-0 min-w-0 text-base leading-snug font-bold text-pretty'}>{answers.name ? copy.text.replace('{name}', answers.name) : copy.textNoName}</p>
    <div className={compact ? 'flex flex-wrap items-center gap-1 [&>*]:!w-auto' : 'grid w-full max-w-sm gap-2 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap sm:justify-center'}>
      {answers.finished
        ? <Button type="button" size="sm" className="w-full sm:w-auto" onPointerEnter={authDialog.preload} onFocus={authDialog.preload} onClick={() => authDialog.open('join')}>{copy.create}</Button>
        : <Button asChild size="sm" className="w-full sm:w-auto"><Link to={answers.path === 'parent' ? '/onboarding/parent' : '/onboarding'}>{copy.continue}</Link></Button>}
      <Button type="button" variant="ghost" size="sm" className="w-full sm:w-auto" onClick={erase}>{copy.clear}</Button>
    </div>
  </aside>;
}
