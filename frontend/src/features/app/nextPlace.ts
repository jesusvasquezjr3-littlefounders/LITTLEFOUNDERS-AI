import { DESTINATIONS, type Destination } from '@/features/app/homeData';

/*
 * Where a person was going when the application had to send them somewhere else first: a visitor
 * who opened a link to `/wallet` and has to sign in, or a new account that has to choose its name
 * and its mentor. Once they are in, they are taken to that place and not to the home.
 *
 * What is kept is the name of one of the application's own places, in this tab only
 * (`sessionStorage`, so it survives the trip to Google and back). Never an address: nothing a link
 * carries can send a person anywhere but one of these places. A place the account does not have
 * (Family, for somebody under 18) is refused by the application as always.
 */
const KEY = 'lf.next';

/** The destination a path names, or null. Whatever its case, as the router matches it. */
export function destinationOf(pathname: string): Destination | null {
  const first = (pathname.split('/')[1] ?? '').toLowerCase();

  return DESTINATIONS.find((destination) => destination === first) ?? null;
}

export const nextPlace = {
  /** Remembers the place a path names. */
  keep(pathname: string): void {
    const place = destinationOf(pathname);

    try {
      if (place && place !== 'home') window.sessionStorage.setItem(KEY, place);
    } catch {
      // storage is closed to this page: the person lands on the home
    }
  },

  /** The path to take a person to once they are in. */
  path(): string {
    try {
      return `/${destinationOf(`/${window.sessionStorage.getItem(KEY) ?? ''}`) ?? 'home'}`;
    } catch {
      return '/home';
    }
  },

  /** The person arrived. */
  clear(): void {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      // nothing was kept
    }
  },
};
