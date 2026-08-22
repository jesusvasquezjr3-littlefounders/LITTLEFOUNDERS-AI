import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
import { AnchorProvider } from '@/tutor-scene/ScreenAnchor';
import { SafeAreaProvider } from '@/tutor-scene/SafeAreaContext';
import { OfferChips } from '../OfferChips';
import { PersonalizeInWorld } from '../PersonalizeInWorld';
import { TutorBubble, TutorTranscript } from '../TutorBubble';
import { LiveSegmentPanel } from '../LiveSegmentPanel';
import { VoiceConsentControl } from '../VoiceConsentControl';
import type { TutorCatalog, TutorOffers, TutorPreferences } from '../types';
import type { LiveSegmentState } from '../useTutorSocket';

/*
 * `/dev/tutor-lab` — the Tutor's visual QA surface, dev-gated out of
 * production exactly like `/dev/lesson-lab` and `/dev/scene-lab`.
 *
 * WHY IT EXISTS. Every panel in the Tutor depends on a live session: a Core
 * token, a running Oracle, a model key, a websocket. Verifying that the picker
 * reflows correctly at 375 px should not require any of that, and if it does,
 * nobody checks it. This renders each surface against fixtures so both
 * breakpoints can be looked at in seconds — which is the §1.11 requirement,
 * and the only way it actually gets met on a Tuesday.
 *
 * It is NOT a mock of the session. There is no fake socket here, no scripted
 * conversation, no pretend model: the conversation itself is exercised by
 * `src/tutor/__tests__` and by a real session. This lab is for LOOKING at
 * layout, spacing, contrast and reflow.
 */

const PREFERENCES: TutorPreferences = {
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  backdrop: 'auto',
  nickname: 'Robi',
  adaptations: ['more_examples'],
};

const CATALOG: TutorCatalog = {
  characters: ['dina', 'liruf', 'rho', 'zara'],
  dioramas: ['diorama-a', 'diorama-b'],
  backdrops: ['auto', 'dawn', 'day', 'dusk', 'night'],
  adaptations: ['slower_pacing', 'more_examples', 'less_text', 'more_visual', 'repeat_before_advancing'],
  articulates: ['rho', 'zara'],
};

const OFFERS: TutorOffers = {
  locale: 'es-MX',
  intelDegraded: false,
  canStart: true,
  startBlockedBy: null,
  voiceAvailable: true,
  microphoneBlockedBy: null,
  weakSkills: [
    {
      skillKey: 'financial-education/ahorro-con-meta',
      courseId: null,
      topicId: null,
      recommendedAction: 'practice',
      reasonCode: 'low_recent_accuracy',
    },
  ],
  faqIds: ['what_is_saving', 'why_prices_change', 'what_is_a_budget', 'how_does_a_loan_work'],
  canAskOpen: true,
};

const SEGMENT: LiveSegmentState = {
  segmentId: '11111111-1111-4111-8111-111111111111',
  seq: 0,
  origin: 'live',
  scoresXp: true,
  framing: 'Vamos a probar esto.',
  segment: {
    id: 'demo-1',
    type: 'quiz_mcq',
    prompt_md: 'Si ahorras **25 pesos** cada semana, ¿cuánto juntas en 4 semanas?',
    difficulty: 2,
    xp: 20,
    payload: {
      options: [
        { id: 'a', text_md: '100 pesos' },
        { id: 'b', text_md: '75 pesos', rationale_md: 'Eso serían solo tres semanas.' },
        { id: 'c', text_md: '29 pesos', rationale_md: 'Ahí sumaste en vez de multiplicar.' },
      ],
    },
  },
};

const HISTORY = [
  { speaker: 'tutor' as const, text: '¡Hola Robi! ¿En qué quieres trabajar hoy?', seq: 1 },
  { speaker: 'learner' as const, text: 'quiero ahorrar para una bici', seq: -1 },
  {
    speaker: 'tutor' as const,
    text: 'Buenísimo. ¿Sabes más o menos cuánto cuesta la bici que quieres?',
    seq: 2,
  },
];

/*
 * `personalize` is here for ONE thing: the plate's silhouette.
 *
 * It used to be deliberately absent, on the grounds that the picker is now
 * controls anchored to points inside the live scene and there was no 2D layout
 * left to look at. That was true of the CHIPS and false of the plate, which is
 * the one surface on the route that is anchored to the viewport — and the plate
 * is what the owner rejected, twice, for being a form. A silhouette is a
 * perceptual fact that no test can argue with, and `/tutor` needs a session, a
 * token and a running Oracle before anybody can see one.
 *
 * What renders here is therefore the plate ALONE. Every world chip registers
 * with the anchor provider and is `hidden` until a projector places it, and
 * there is no projector on this page — correctly, since there is no island for
 * a chip to point at. That is not half a picture: it is exactly the surface
 * under review, at both breakpoints, in both themes.
 */
type Surface = 'offer' | 'personalize' | 'conversation' | 'consent';

/*
 * A scoped `fetch` shim, so the consent control can be LOOKED at.
 *
 * `VoiceConsentControl` reads its own state from Core, which means it renders
 * nothing without a backend — and the one surface in this feature whose exact
 * wording is legally significant would be the one nobody ever eyeballs.
 *
 * The shim is installed only while this dev-only page is mounted, restores the
 * real `fetch` on unmount, and passes anything it does not recognise straight
 * through. The alternative was a test-only prop on the component itself, and a
 * production component should not carry a door that exists for a harness.
 */
function useStubbedTutorConsent(active: boolean) {
  // A REF, and installed ONCE. Keying the effect on `active` reinstalled the
  // shim, and React runs child effects before parent ones — so a remounting
  // control fetched against the real API in the gap and rendered an error.
  const current = useRef(active);
  current.current = active;

  useEffect(() => {
    const real = window.fetch;
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.includes('/tutor/consent/')) {
        const granted = current.current;
        return new Response(
          JSON.stringify({
            data: { active: granted, grantedAt: granted ? '2026-08-01T10:00:00Z' : null, locale: 'es-MX' },
            error: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return real(input, init);
    }) as typeof window.fetch;
    return () => {
      window.fetch = real;
    };
  }, []);
}

export default function TutorLabPage() {
  const { t } = useTranslation();
  const [surface, setSurface] = useState<Surface>('offer');
  const [preferences] = useState(PREFERENCES);
  const [consentActive, setConsentActive] = useState(false);
  useStubbedTutorConsent(consentActive);

  return (
    <div className="min-h-screen bg-surface-sunken">
      <div className="mx-auto max-w-container px-5 py-6 md:px-8 md:py-10">
        <header className="mb-6">
          <h1 className="lf-display-lg text-content">Tutor Lab</h1>
          <p className="lf-body text-content-muted">
            Every Tutor surface against fixtures. Check both breakpoints here before shipping.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          {(['offer', 'personalize', 'conversation', 'consent'] as const).map((id) => (
            <Button
              key={id}
              variant={surface === id ? 'primary' : 'secondary'}
              onClick={() => setSurface(id)}
            >
              {id}
            </Button>
          ))}
        </div>

        {surface === 'offer' && (
          /*
            What is on show here is the GUARANTEED arrangement, not the in-scene
            one. With `ready` false the openings render as the centred column a
            device with no WebGL gets, which is a real surface with real reflow
            to check; the anchored version needs a camera to hang off and is
            looked at on `/tutor` itself. The box is `relative` because the
            layer positions itself against its nearest positioned ancestor, and
            on a page with none it would escape to the whole viewport.
          */
          <div className="relative min-h-[34rem] overflow-hidden rounded-lg bg-surface-sunken">
            <OfferChips
              phase="introducing"
              ready={false}
              offers={OFFERS}
              starting={false}
              startError={null}
              onStart={() => setSurface('conversation')}
              onPersonalize={() => undefined}
              // Empty on purpose: the lab never calls Core, and a real token in
              // a fixture is a credential in a fixture.
              token=""
              character={preferences.character}
              nickname={preferences.nickname}
            />
          </div>
        )}

        {surface === 'personalize' && (
          /*
            The plate is `position: fixed`, so it lands against the WINDOW and
            not against this box — which is how it behaves on the stage and is
            the point of looking at it. The note below is what the rest of the
            screen would be: an island, with the candidates standing on it.
          */
          <SafeAreaProvider>
            <AnchorProvider>
              <div className="relative min-h-[34rem] overflow-hidden rounded-lg bg-surface-sunken p-6">
                <p className="lf-body text-content-muted">
                  On /tutor this space is the island, with all four candidates standing on it and a
                  name plate over each head. What is pinned to the viewport is the plate below:
                  check its resting shape first, then open it.
                </p>
              </div>
              <PersonalizeInWorld
                phase="personalizing"
                ready
                preferences={preferences}
                catalog={CATALOG}
                saving={false}
                onSave={() => undefined}
                onDone={() => undefined}
              />
            </AnchorProvider>
          </SafeAreaProvider>
        )}

        {surface === 'consent' && (
          <div className="space-y-4">
            <p className="lf-body text-content-muted">
              The guardian&rsquo;s microphone gate, as it appears on /family. Toggle the fixture to
              see both states; the wording below is what Core stores verbatim.
            </p>
            <div className="flex gap-2">
              <Button
                variant={consentActive ? 'secondary' : 'primary'}
                onClick={() => setConsentActive(false)}
              >
                not granted
              </Button>
              <Button
                variant={consentActive ? 'primary' : 'secondary'}
                onClick={() => setConsentActive(true)}
              >
                granted
              </Button>
            </div>
            <div className="rounded-lg border border-outline bg-surface">
              <VoiceConsentControl
                key={String(consentActive)}
                kidUserId="11111111-1111-4111-8111-111111111111"
                token="lab"
                kidName="Ana"
              />
            </div>
          </div>
        )}

        {surface === 'conversation' && (
          /*
           * WHAT THIS SURFACE CAN AND CANNOT SHOW, now that the conversation is
           * composed in the scene.
           *
           * The caption, the adaptation chips and the microphone cluster are
           * positioned by projecting a point in the 3D scene, or against the
           * viewport, so they only mean anything over a live stage. Rendering
           * them here would float them across this page's own chrome and prove
           * nothing about how they sit over the island. They are looked at on
           * `/tutor` and on `/dev/scene-lab`.
           *
           * What IS worth checking without a socket is the content of the
           * lesson plate at both breakpoints: the bubble's wrapping, the
           * exercise renderer inside 420 px, and the transcript. The box below
           * is the plate's inner width and opaque floor, and nothing else.
           */
          <div className="mx-auto flex w-full max-w-[26rem] flex-col gap-3 rounded-xl bg-surface p-4">
            <TutorBubble
              character={preferences.character}
              emotion="happy"
              action="nod"
              actionKey={2}
              speaking
              history={HISTORY}
              line={HISTORY[2]?.text ?? null}
              label={t('tutor.conversation.bubbleLabel')}
              transcript={false}
            />

            {/* An empty token: the lab never grades, and a real one here
                would be a credential in a fixture. */}
            <LiveSegmentPanel live={SEGMENT} token="" onGraded={() => undefined} />

            <TutorTranscript history={HISTORY} label={t('tutor.conversation.transcriptLabel')} />
          </div>
        )}

      </div>
    </div>
  );
}
