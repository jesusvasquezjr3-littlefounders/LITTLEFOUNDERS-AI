import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../../../../mentor/session/coreApi';
import { arAgeFromScreen } from './arAge';
import { ArPilotContext, type ArPilotEnvironment } from './arPilot';

/*
 * F4.9: gives the AR board the signed-in learner's real age (a band read from Core, see arAge.ts). It is mounted only when
 * the pilot flag is on and the app supplied no age, so a build with the flag off never asks Core anything for the pilot.
 * Until Core answers, and whenever it cannot, the age is null and the pilot stays closed. The signed-in learner and the token
 * source come from the environment's `learner`, which the app supplies (the rebuilt UI imports nothing from the legacy auth
 * layer); with none, nothing is asked and the pilot stays closed. Consent is not read here: it comes from the environment's
 * own `consent`, which is null until a verified-consent record exists in Core.
 */
export function ArLearnerAge({ base, children }: { base: ArPilotEnvironment; children: ReactNode }) {
  const userId = base.learner?.userId ?? null;
  const getToken = base.learner?.getToken;
  const [age, setAge] = useState<number | null>(null);
  useEffect(() => {
    setAge(null);
    if (!userId || !getToken) return;
    let current = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token || !current) return;
        const response = await api<unknown>('/auth/age-screen', { token });
        if (current) setAge(response.error ? null : arAgeFromScreen(response.data));
      } catch {
        if (current) setAge(null);
      }
    })();
    return () => { current = false; };
  }, [userId, getToken]);
  const environment = useMemo<ArPilotEnvironment>(() => ({ ...base, age }), [base, age]);
  return <ArPilotContext.Provider value={environment}>{children}</ArPilotContext.Provider>;
}
