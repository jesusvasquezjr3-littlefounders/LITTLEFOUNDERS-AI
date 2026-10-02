import { createContext, useContext, type ReactNode } from 'react';

const NONE: Readonly<Record<string, string>> = Object.freeze({});
const AttemptSeedContext = createContext<Readonly<Record<string, string>>>(NONE);

/** The seeds Core issued for this run, segment id to seed. Only a seeded board reads one. */
export function AttemptSeedProvider({ seeds, children }: { seeds?: Readonly<Record<string, string>>; children: ReactNode }) {
  return <AttemptSeedContext.Provider value={seeds ?? NONE}>{children}</AttemptSeedContext.Provider>;
}

/** The seed of this attempt, or null when Core has issued none: a board then has nothing to simulate and must not run. */
export function useAttemptSeed(segmentId: string): string | null {
  const seeds = useContext(AttemptSeedContext);
  return Object.hasOwn(seeds, segmentId) ? (seeds[segmentId] as string) : null;
}
