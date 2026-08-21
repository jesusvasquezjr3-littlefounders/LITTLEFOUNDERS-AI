import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
import { PersonalizePanel } from '../PersonalizePanel';
import { OfferPanel } from '../OfferPanel';
import { SpeechCaption } from '../SpeechCaption';
import { TutorBubble } from '../TutorBubble';
import { LiveSegmentPanel } from '../LiveSegmentPanel';
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

const CATALOG: TutorCatalog = {
  characters: ['dina', 'liruf', 'rho', 'zara'],
  dioramas: ['diorama-a', 'diorama-b'],
  backdrops: ['auto', 'dawn', 'day', 'dusk', 'night'],
  adaptations: ['slower_pacing', 'more_examples', 'less_text', 'more_visual', 'repeat_before_advancing'],
  articulates: ['rho', 'zara'],
};

const PREFERENCES: TutorPreferences = {
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  backdrop: 'auto',
  nickname: 'Robi',
  adaptations: ['more_examples'],
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

type Surface = 'personalize' | 'offer' | 'conversation';

export default function TutorLabPage() {
  const { t } = useTranslation();
  const [surface, setSurface] = useState<Surface>('personalize');
  const [preferences, setPreferences] = useState(PREFERENCES);

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
          {(['personalize', 'offer', 'conversation'] as const).map((id) => (
            <Button
              key={id}
              variant={surface === id ? 'primary' : 'secondary'}
              onClick={() => setSurface(id)}
            >
              {id}
            </Button>
          ))}
        </div>

        {surface === 'personalize' && (
          <PersonalizePanel
            preferences={preferences}
            catalog={CATALOG}
            saving={false}
            onSave={(patch) => setPreferences((prev) => ({ ...prev, ...patch }))}
            onDone={() => setSurface('offer')}
          />
        )}

        {surface === 'offer' && (
          <OfferPanel
            offers={OFFERS}
            voiceAvailable
            microphoneBlockedBy={null}
            starting={false}
            onStart={() => setSurface('conversation')}
          />
        )}

        {surface === 'conversation' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-col gap-4">
              {/* A stand-in for the canvas: this lab is about LAYOUT, and
                  loading three.js here would make it slow for no benefit.
                  /dev/scene-lab is where the real stage is exercised. */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface sm:aspect-video">
                <SpeechCaption text={HISTORY[2]?.text ?? ''} turnSeq={2} instant />
                <p className="lf-caption absolute inset-0 flex items-center justify-center text-content-muted">
                  (3D stage — see /dev/scene-lab)
                </p>
              </div>

              <TutorBubble
                character={preferences.character}
                emotion="happy"
                action="nod"
                actionKey={2}
                speaking
                history={HISTORY}
                className="max-h-64 lg:max-h-80"
              />
            </div>

            <div className="flex min-h-[12rem] flex-col gap-4">
              {/* An empty token: the lab never grades, and a real one here
                  would be a credential in a fixture. */}
              <LiveSegmentPanel live={SEGMENT} token="" onGraded={() => undefined} />

              <div className="rounded-lg border border-primary bg-accent-soft p-4">
                <p className="lf-body mb-3 text-content">{t('tutor.adaptationOffer.more_examples')}</p>
                <div className="flex gap-2">
                  <Button className="flex-1">{t('tutor.conversation.yesPlease')}</Button>
                  <Button variant="secondary" className="flex-1">
                    {t('tutor.conversation.noThanks')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
