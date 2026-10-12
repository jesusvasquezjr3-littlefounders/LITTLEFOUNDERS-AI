import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSession } from '@/features/auth/session';
import type { AuthEntry, Mode } from '@/features/auth/AuthWindow';
import { NO_PERMISSION_FROM } from '@/features/onboarding/Handoff';
import { onboarding, useOnboardingAnswers } from '@/features/onboarding/store';

/*
 * Lets anything open the sign-in window (`useAuthDialog().open()`), and opens it by itself at the
 * age step for an account that has not said its age (it has no type until it does).
 *
 * The window itself, with its form fields, is in AuthWindow.tsx and is downloaded the first time it
 * is opened, so the landing page does not carry a form most visitors never see. `preload` fetches
 * it early, when the pointer or the focus reaches a button that opens it.
 */
const loadWindow = () => import('@/features/auth/AuthWindow');

const AuthWindow = lazy(loadWindow);

/** `join` is creating an account with every way to do it on offer (Google or a code): where the onboarding ends. */
/** `join` is the end of the onboarding; `age` is the one step an account that has not said its age still owes. */
type AuthDialogContext = { open: (mode?: Mode | 'join' | 'age') => void; preload: () => void };

const Context = createContext<AuthDialogContext | null>(null);

/** Opens the sign-in window from anywhere under `AuthDialogProvider`. */
export function useAuthDialog(): AuthDialogContext {
  const context = useContext(Context);

  if (!context) throw new Error('useAuthDialog needs an AuthDialogProvider above it');

  return context;
}

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [isOpen, setIsOpen] = useState(false);
  // One visit to the window: where it starts, and a number that makes each visit start fresh.
  const [visit, setVisit] = useState<{ id: number; entry: AuthEntry } | null>(null);
  const askedAge = useRef(false);
  const answers = useOnboardingAnswers();
  // The person gave an age in the onboarding a moment ago, in this tab, and it needs no permission
  // box: it is recorded for them (features/onboarding/Handoff.tsx) and the window does not ask again.
  const ageIsComing = answers?.finished === true && answers.age !== undefined && answers.age >= NO_PERMISSION_FROM && onboarding.isSameSitting();
  const opener = useRef<Element | null>(null);

  const start = useCallback((entry: AuthEntry) => {
    opener.current = document.activeElement;
    setVisit((previous) => ({ id: (previous?.id ?? 0) + 1, entry }));
    setIsOpen(true);
  }, []);

  // An account that has not said its age yet: ask as soon as it is seen, once per page load.
  useEffect(() => {
    if (session.status !== 'signedIn' || !session.account?.needsAge || askedAge.current || isOpen || ageIsComing) return;

    askedAge.current = true;
    start({ mode: 'signIn', step: 'age' });
  }, [session.status, session.account, isOpen, start, ageIsComing]);

  // The window asked the age itself at the end of a sign-in: do not ask again when it closes.
  useEffect(() => {
    if (isOpen && session.status === 'signedIn' && !ageIsComing) askedAge.current = true;
  }, [isOpen, session.status, ageIsComing]);

  const context = useMemo<AuthDialogContext>(() => ({
    open: (mode = 'signIn') => start(mode === 'age' ? { mode: 'signIn', step: 'age' } : mode === 'join' ? { mode: 'signUp', step: 'choose' } : { mode, step: mode === 'signUp' ? 'identifier' : 'choose' }),
    preload: () => { void loadWindow(); },
  }), [start]);

  return <Context.Provider value={context}>
    {children}
    {visit ? <Suspense fallback={null}>
      <AuthWindow key={visit.id} isOpen={isOpen} onOpenChange={setIsOpen} entry={visit.entry} opener={opener} />
    </Suspense> : null}
  </Context.Provider>;
}
