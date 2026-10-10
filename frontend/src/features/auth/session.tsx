import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as z from 'zod/mini';
import { useLocale } from '@/i18n/useCopy';
import { api, ApiFailure, apiUrl } from '@/lib/api';

/*
 * Who is signed in, for the whole app. The session itself is two HttpOnly cookies that this code
 * cannot see; what it holds is the account Core describes.
 *
 * A visitor who never signed in makes no call to Core at all: a flag in localStorage (`lf.session`,
 * the single character "1", no personal data) records that this browser signed in once, and only
 * then is the session asked for on load. The flag grants nothing; Core decides from the cookies.
 */
const Account = z.object({
  id: z.string(),
  email: z.nullable(z.string()),
  username: z.nullable(z.string()),
  displayName: z.string(),
  locale: z.enum(['en-US', 'es-MX', 'pt-BR']),
  roles: z.array(z.enum(['universal', 'child', 'parent', 'admin', 'superadmin'])),
  type: z.nullable(z.enum(['child', 'universal'])),
  needsAge: z.boolean(),
});

export type Account = z.infer<typeof Account>;

const WithAccount = z.object({ account: Account });

const CodeSent = z.object({ sent: z.boolean(), codeLength: z.number(), expiresInSeconds: z.number(), resendAfterSeconds: z.number() });

const AgeRecorded = z.object({ type: z.nullable(z.enum(['child', 'universal'])), recorded: z.boolean() });

const SignedOut = z.object({ signedOut: z.boolean() });

const LocaleSaved = z.object({ locale: z.enum(['en-US', 'es-MX', 'pt-BR']) });

export type GoogleResult = 'ok' | 'cancelled' | 'failed' | 'unavailable';

/** What the Google window says when it is done. A word, never a token. */
export const GOOGLE_CHANNEL = 'lf-google-sign-in';

const GoogleMessage = z.object({ result: z.enum(['ok', 'cancelled', 'failed', 'unavailable']) });

export function parseGoogleResult(value: string | null): GoogleResult {
  const parsed = GoogleMessage.safeParse({ result: value });

  return parsed.success ? parsed.data.result : 'failed';
}

type Status = 'loading' | 'signedOut' | 'signedIn';

type Session = {
  status: Status;
  account: Account | null;
  requestCode: (identifier: string, locale: string) => Promise<z.infer<typeof CodeSent>>;
  verifyCode: (identifier: string, code: string) => Promise<Account>;
  declareAge: (age: number, guardianPermission: boolean) => Promise<Account>;
  /** Opens Google's account chooser in a small window (or in this tab when the browser blocks windows) and resolves when it is done. */
  signInWithGoogle: () => Promise<GoogleResult>;
  /** Asks Core for the session again, after something outside this page changed it. */
  reload: () => Promise<Account | null>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

const FLAG = 'lf.session';

function flag(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(FLAG, '1');
    else window.localStorage.removeItem(FLAG);
  } catch {
    // Storage can be blocked. The only cost is one extra request the next time the page loads.
  }
}

function hasFlag(): boolean {
  try {
    return window.localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

/** The current session, renewing it once if the short-lived cookie has run out. */
async function fetchAccount(): Promise<Account | null> {
  try {
    return (await api('/api/v1/auth/session', WithAccount)).account;
  } catch (first) {
    if (!(first instanceof ApiFailure) || first.status !== 401) throw first;
  }

  try {
    return (await api('/api/v1/auth/refresh', WithAccount, { method: 'POST', body: {} })).account;
  } catch (second) {
    if (second instanceof ApiFailure && second.status === 401) return null;

    throw second;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(() => (hasFlag() ? 'loading' : 'signedOut'));
  const [account, setAccount] = useState<Account | null>(null);
  const started = useRef(false);
  const locale = useLocale();
  const localeSaved = useRef<Promise<unknown>>(Promise.resolve());

  const adopt = useCallback((next: Account | null) => {
    setAccount(next);
    setStatus(next ? 'signedIn' : 'signedOut');
    flag(next !== null);

    return next;
  }, []);

  const reload = useCallback(async () => {
    try {
      return adopt(await fetchAccount());
    } catch {
      // Core could not be reached. Keep the flag, so the next load tries again, and show the page signed out.
      setStatus('signedOut');

      return null;
    }
  }, [adopt]);

  useEffect(() => {
    if (started.current || !hasFlag()) return;

    started.current = true;
    void reload();
  }, [reload]);

  /*
   * The account's language is the one the person uses the site in, and emails are written in it. So
   * whenever the two differ for a signed-in person (right after signing in, or when they change the
   * language) the site's language is saved to the account. A failure costs nothing but an email in
   * the previous language, and the next page load tries again.
   */
  useEffect(() => {
    if (status !== 'signedIn' || !account || account.locale === locale) return;

    localeSaved.current = api('/api/v1/account/locale', LocaleSaved, { method: 'PUT', body: { locale } })
      .then((saved) => setAccount((current) => (current ? { ...current, locale: saved.locale } : current)))
      .catch(() => null);
  }, [status, account, locale]);

  const value = useMemo<Session>(() => ({
    status,
    account,
    reload,

    requestCode: (identifier, locale) => api('/api/v1/auth/code', CodeSent, { method: 'POST', body: { identifier, locale } }),

    async verifyCode(identifier, code) {
      const answer = await api('/api/v1/auth/code/verify', WithAccount, { method: 'POST', body: { identifier, code } });

      adopt(answer.account);

      return answer.account;
    },

    async declareAge(age, guardianPermission) {
      // The welcome email goes out when the age is recorded: let the language reach the account first.
      await localeSaved.current;
      await api('/api/v1/account/age', AgeRecorded, { method: 'POST', body: { age, guardianPermission } });

      const next = await fetchAccount();

      if (!next) throw new ApiFailure('SESSION_EXPIRED', 401);

      adopt(next);

      return next;
    },

    signInWithGoogle: () => new Promise<GoogleResult>((resolve) => {
      const target = (mode: 'popup' | 'redirect') => apiUrl(`/api/v1/auth/google/start?mode=${mode}`);
      const width = 480;
      const height = 640;
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
      const popup = window.open(target('popup'), 'lf-google', `popup,width=${width},height=${height},left=${left},top=${top}`);

      // The browser refused a window (common on phones): do the same trip in this tab.
      if (!popup) {
        window.location.assign(target('redirect'));

        return;
      }

      const channel = new BroadcastChannel(GOOGLE_CHANNEL);
      let settled = false;

      const finish = (result: GoogleResult) => {
        if (settled) return;

        settled = true;
        window.clearTimeout(giveUp);
        channel.close();
        void (result === 'ok' ? reload() : Promise.resolve(null)).then(() => resolve(result));
      };

      /*
       * The window says how it went, over a channel only pages of this site can use. Whether the
       * window is still open cannot be asked: once it is on Google, the browser cuts the link
       * between the two windows on purpose (Google's cross-origin opener policy), and `closed`
       * reads true while the person is still choosing an account. So the wait simply ends after
       * the ten minutes the sign-in itself is valid for.
       */
      channel.onmessage = (event: MessageEvent<Record<string, string>>) => {
        const message = GoogleMessage.safeParse(event.data);

        if (message.success) finish(message.data.result);
      };

      const giveUp = window.setTimeout(() => finish('cancelled'), 10 * 60 * 1000);
    }),

    async signOut() {
      try {
        await api('/api/v1/auth/sign-out', SignedOut, { method: 'POST', body: {} });
      } finally {
        adopt(null);
      }
    },
  }), [status, account, reload, adopt]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);

  if (!session) throw new Error('useSession needs a SessionProvider above it');

  return session;
}
