import { useCallback, useEffect, useState } from 'react';
import * as z from 'zod/mini';
import type { Guest } from '@/features/app/guest';
import { api } from '@/lib/api';

/*
 * The home of the signed-in person, as Core describes it in one read (D-051): the name they asked
 * to be called, their mentor, the places their menu has, the composition of the day (D-052) and the
 * cards of their day. Core decides all of it; this code asks and parses.
 *
 * The only thing the browser tells Core is which calendar day it is here, so the composition
 * changes at the person's own midnight and not at Core's.
 */
export const DESTINATIONS = ['home', 'learn', 'mentor', 'wallet', 'tasks', 'family'] as const;

export type Destination = (typeof DESTINATIONS)[number];

const Home = z.object({
  displayName: z.string(),
  mentor: z.nullable(z.enum(['zara', 'rho', 'liruf', 'dina'])),
  destinations: z.array(z.enum(DESTINATIONS)),
  // a name Core chose from its catalog: the files are public/stage/loops/<name>-<mode>.mp4 and -poster.webp
  // `number` of `total`: how far the person is through this round of the catalog
  composition: z.object({ name: z.string().check(z.regex(/^[a-z-]{1,40}$/)), day: z.string(), number: z.number(), total: z.number() }),
  // a card belongs to a feature and arrives with it; none exists yet
  cards: z.array(z.unknown()),
});

export type Home = z.infer<typeof Home>;

const WithHome = z.object({ home: Home });

/** The person's own calendar day, as YYYY-MM-DD. */
function localDay(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export type HomeState = { status: 'loading' } | { status: 'failed'; retry: () => void } | { status: 'ready'; home: Home };

/**
 * Asks Core for the home once, again when asked to retry, and again when `version` changes: the
 * account's name or mentor was just set (the onboarding's hand-off does it right after signing in).
 *
 * A guest (guest.ts) asks the read that knows nobody; their name and mentor are their browser's.
 */
export function useHome(version: string, guest: Guest | null): HomeState {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'failed' } | { status: 'ready'; home: Home }>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ status: 'loading' });

    setAttempt((count) => count + 1);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    api(`/api/v1/home${guest ? '/guest' : ''}?day=${localDay()}`, WithHome).then(
      ({ home }) => { if (isCurrent) setState({ status: 'ready', home: guest ? { ...home, displayName: guest.name, mentor: guest.mentor } : home }); },
      () => { if (isCurrent) setState({ status: 'failed' }); },
    );

    return () => { isCurrent = false; };
  }, [attempt, version, guest]);

  return state.status === 'failed' ? { status: 'failed', retry } : state;
}
