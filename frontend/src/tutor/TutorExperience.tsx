import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Button, Card } from '@/components/ui';
import { getOffers, getPreferences, savePreferences, startSession, type StartSessionInput } from './tutorApi';
import { PersonalizePanel } from './PersonalizePanel';
import { OfferPanel } from './OfferPanel';
import { ConversationView } from './ConversationView';
import { SessionHistory } from './SessionHistory';
import { TutorStage } from '@/tutor-scene/TutorStage';
import { useTutorSocket } from './useTutorSocket';
import type { StartedSession, TutorCatalog, TutorOffers, TutorPreferences } from './types';

/*
 * The Tutor, as the learner meets it (/ORACLE.md §1).
 *
 *   personalize → offer → conversation → close → replay
 *
 * PERSONALIZATION IS AN INVITATION, NOT A TOLL GATE. The picker opens on the
 * first visit and never again; the defaults are good enough that skipping it
 * entirely produces a good session. A learner who wants to start should be one
 * tap from starting.
 *
 * The socket is opened by the HOOK when a URL exists, so this component holds
 * a phase and not a connection. That split is what keeps a re-render from
 * dropping a live session.
 */

type Phase = 'loading' | 'personalize' | 'offer' | 'conversing' | 'ended' | 'unavailable';

export function TutorExperience() {
  const { t } = useTranslation();
  const { getToken } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [preferences, setPreferences] = useState<TutorPreferences | null>(null);
  const [catalog, setCatalog] = useState<TutorCatalog | null>(null);
  const [offers, setOffers] = useState<TutorOffers | null>(null);
  const [session, setSession] = useState<StartedSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const socket = useTutorSocket(phase === 'conversing' ? (session?.socketUrl ?? null) : null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const authToken = await getToken();
      if (cancelled) return;
      if (!authToken) {
        setPhase('unavailable');
        return;
      }
      setToken(authToken);

      const [prefsResult, offersResult] = await Promise.all([
        getPreferences(authToken),
        getOffers(authToken),
      ]);
      if (cancelled) return;

      if (!prefsResult.data || !offersResult.data) {
        // Refuse rather than improvising defaults: a learner whose chosen
        // character silently reverted to Rho because a read failed would
        // reasonably conclude the product forgot them (§1.14).
        setPhase('unavailable');
        return;
      }

      const { catalog: served, ...prefs } = prefsResult.data;
      setPreferences(prefs);
      setCatalog(served);
      setOffers(offersResult.data);
      // A learner who has never picked anything sees the picker once. The
      // marker is the nickname, which is the one field with no useful default.
      setPhase(prefs.nickname === null ? 'personalize' : 'offer');
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const persistPreferences = useCallback(
    (patch: Partial<TutorPreferences>) => {
      if (!token) return;
      setSaving(true);
      setPreferences((prev) => (prev ? { ...prev, ...patch } : prev));
      void savePreferences(token, patch).then((result) => {
        setSaving(false);
        if (result.data) setPreferences(result.data);
      });
    },
    [token],
  );

  const begin = useCallback(
    (input: StartSessionInput) => {
      if (!token) return;
      setStarting(true);
      setStartError(null);
      void startSession(token, input).then((result) => {
        setStarting(false);
        if (result.error || !result.data) {
          setStartError(result.error?.code ?? 'INTERNAL');
          return;
        }
        setSession(result.data);
        setPhase('conversing');
      });
    },
    [token],
  );

  // The session ended on the server side. Move the UI with it rather than
  // leaving a dead socket behind a live-looking screen.
  useEffect(() => {
    if (phase !== 'conversing') return;
    if (socket.closedReason !== null || socket.connection === 'closed' || socket.connection === 'failed') {
      setPhase('ended');
    }
  }, [phase, socket.closedReason, socket.connection]);

  if (phase === 'loading') {
    return <p className="lf-body text-content-muted">{t('tutor.page.loading')}</p>;
  }

  if (phase === 'unavailable') {
    /*
     * DEGRADE TO THE ISLAND, not to an error card.
     *
     * `/tutor` has shown the 3D stage in production since August; if the Tutor
     * API is unreachable — a bad deploy order, a Core outage, a migration not
     * yet applied — replacing a working scene with a grey apology is strictly
     * worse than what was already there. The learner still gets their
     * characters, and the message says plainly that the talking part is
     * resting rather than pretending the page is broken.
     *
     * It also removes a deploy-order hazard: Core can ship the tutor routes
     * before its schema and variables land without the page regressing.
     */
    return (
      <div className="space-y-4">
        <TutorStage className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-sunken lg:aspect-video" />
        <Card className="p-6 text-center">
          <p className="lf-body text-content-muted">{t('tutor.page.unavailable')}</p>
        </Card>
      </div>
    );
  }

  if (phase === 'personalize' && preferences && catalog) {
    return (
      <PersonalizePanel
        preferences={preferences}
        catalog={catalog}
        saving={saving}
        onSave={persistPreferences}
        onDone={() => setPhase('offer')}
      />
    );
  }

  if (phase === 'conversing' && session && token) {
    return (
      <ConversationView
        session={session}
        socket={socket}
        token={token}
        onExit={() => {
          socket.endSession();
          setPhase('ended');
        }}
      />
    );
  }

  if (phase === 'ended') {
    return (
      <div className="space-y-4">
        <Card className="space-y-3 p-6 text-center">
          <p className="lf-headline text-content">{t('tutor.page.seeYouSoon')}</p>
          <p className="lf-body text-content-muted">{t('tutor.page.sessionSaved')}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => setPhase('offer')}>{t('tutor.page.startAnother')}</Button>
          </div>
        </Card>
        {token && <SessionHistory token={token} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {offers && (
        <OfferPanel
          offers={offers}
          voiceAvailable={offers.voiceAvailable}
          microphoneBlockedBy={offers.microphoneBlockedBy}
          starting={starting || !offers.canStart}
          onStart={begin}
        />
      )}

      {!offers?.canStart && (
        <p className="lf-body rounded-md bg-warning-soft px-3 py-2 text-content" role="status">
          {t('tutor.page.tutorUnavailable')}
        </p>
      )}

      {startError && (
        <p className="lf-body rounded-md bg-warning-soft px-3 py-2 text-content" role="status">
          {t(`tutor.startError.${startError}`, { defaultValue: t('tutor.startError.INTERNAL') })}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setPhase('personalize')}>
          {t('tutor.page.changeStage')}
        </Button>
      </div>

      {token && (
        <section aria-labelledby="tutor-history">
          <h2 id="tutor-history" className="lf-headline mb-3 text-content">
            {t('tutor.history.title')}
          </h2>
          <SessionHistory token={token} />
        </section>
      )}
    </div>
  );
}
