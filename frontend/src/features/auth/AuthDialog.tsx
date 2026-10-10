import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSession } from '@/features/auth/session';
import type { AuthEntry, Mode } from '@/features/auth/AuthWindow';

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

type AuthDialogContext = { open: (mode?: Mode) => void; preload: () => void };

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
  const opener = useRef<Element | null>(null);

  const start = useCallback((entry: AuthEntry) => {
    opener.current = document.activeElement;
    setVisit((previous) => ({ id: (previous?.id ?? 0) + 1, entry }));
    setIsOpen(true);
  }, []);

  // An account that has not said its age yet: ask as soon as it is seen, once per page load.
  useEffect(() => {
    if (session.status !== 'signedIn' || !session.account?.needsAge || askedAge.current || isOpen) return;

    askedAge.current = true;
    start({ mode: 'signIn', step: 'age' });
  }, [session.status, session.account, isOpen, start]);

  // The window asked the age itself at the end of a sign-in: do not ask again when it closes.
  useEffect(() => {
    if (isOpen && session.status === 'signedIn') askedAge.current = true;
  }, [isOpen, session.status]);

  const context = useMemo<AuthDialogContext>(() => ({
    open: (mode = 'signIn') => start({ mode, step: mode === 'signUp' ? 'identifier' : 'choose' }),
    preload: () => { void loadWindow(); },
  }), [start]);

  return <Context.Provider value={context}>
    {children}
    {visit ? <Suspense fallback={null}>
      <AuthWindow key={visit.id} isOpen={isOpen} onOpenChange={setIsOpen} entry={visit.entry} opener={opener} />
    </Suspense> : null}
  </Context.Provider>;
}
