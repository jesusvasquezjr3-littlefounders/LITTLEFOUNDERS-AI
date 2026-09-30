import { useEffect, useState } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { MENTOR_CHARACTERS, MENTOR_NAMES, type MentorCharacter } from '../design/assets';
import { isMilestone } from '../design/milestones';
import en from '../../i18n/en-US/rebuild-mentor.json';
import es from '../../i18n/es-MX/rebuild-mentor.json';
import pt from '../../i18n/pt-BR/rebuild-mentor.json';
import { MentorStage, type MentorStageScene } from './MentorStage';
import { resolveMentorPose } from './stageStates';
import { MENTOR_SHOTS, type MentorShot } from './session/vocabulary';
import { CLOSING_SCRIPTS, MENTOR_STAGE_STATES, type MentorClosingScript, type MentorStageState } from './stageStates';
import type { StageEnvironment } from './stageMode';
import './mentorStage.css';

/*
 * Development preview of the Mentor stage at full size (the preview entry's `mentor-stage` screen),
 * inside the stage region of the Mentor screen's layout (Frontend Bible 08 §6):
 * about 58% of the height on a phone, half on a tablet, the left 7 of 12
 * columns on a desktop. The other region belongs to the Mentor screen (speech
 * plate, board, response area); here it only names the character (the top
 * bar's title, 08 §2) and what the stage is showing.
 *
 *   ?character=rho|zara|liruf|dina  ?state=<08 §3 state>  ?milestone=<D7 id>
 *   ?closing=<C.16 script>  ?board=1  ?scene=diorama-a|diorama-b  ?shot=<camera shot>
 *   ?device=low-power|no-webgl|data-saver   the stage's fallback on this device (08 §7), without emulating one
 *   ?then=<08 §3 state>   switch to this state a second after the stage is ready: in the fallback, the
 *                         state change plays the pose's rendered sequence once and settles on its still
 *
 * The query is read again on `popstate`, so a harness (the sequence renderer, render-mentor-stage-sequences.mjs)
 * can change the state of a stage that stays mounted: `history.replaceState(...)` then a `popstate` event.
 */
const DEVICES: Record<string, Partial<StageEnvironment>> = {
  'low-power': { lowPower: true }, 'no-webgl': { webgl: false }, 'data-saver': { saveData: true },
};

function useLiveParams(initial: URLSearchParams): URLSearchParams {
  const [params, setParams] = useState(initial);
  useEffect(() => {
    const read = () => setParams(new URLSearchParams(window.location.search));
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);
  return params;
}

export function MentorStagePreview({ locale, theme, ageBand: initialAgeBand, params: initialParams }: {
  locale: Locale; theme: 'light' | 'dark'; ageBand: AgeBand; params: URLSearchParams;
}) {
  const params = useLiveParams(initialParams);
  const ageBands: readonly AgeBand[] = ['6-9', '10-12', '13-17', 'adult'];
  const ageBand = params === initialParams ? initialAgeBand : (ageBands.find((band) => band === params.get('age')) ?? initialAgeBand);
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).mentorStage;
  const pick = <T extends string>(value: string | null, options: readonly T[], fallback: T): T =>
    (options as readonly string[]).includes(value ?? '') ? value as T : fallback;
  const character = pick<MentorCharacter>(params.get('character'), MENTOR_CHARACTERS, 'dina');
  const requested = pick<MentorStageState>(params.get('state'), MENTOR_STAGE_STATES, 'idle');
  const then = params.get('then');
  const [switched, setSwitched] = useState(false);
  const state = switched && then ? pick<MentorStageState>(then, MENTOR_STAGE_STATES, requested) : requested;
  const device = DEVICES[params.get('device') ?? ''];
  const closing = pick<MentorClosingScript>(params.get('closing'), CLOSING_SCRIPTS, 'completed');
  const scene = pick<MentorStageScene>(params.get('scene'), ['diorama-a', 'diorama-b'], 'diorama-a');
  const shot = (MENTOR_SHOTS as readonly string[]).includes(params.get('shot') ?? '') ? params.get('shot') as MentorShot : undefined;
  const milestone = params.get('milestone');
  // `?size=compact`: the lesson band (08 §11), for the band-still renderer and visual checks.
  const size = params.get('size') === 'compact' ? 'compact' : 'full';
  return <div className="lf-rebuild" data-theme={theme} lang={locale} data-age-band={ageBand}>
    <main className="lf-mentor-layout" data-screen="mentor-stage">
      <div className="lf-mentor-layout-stage">
        <MentorStage character={character} state={state} ageBand={ageBand} theme={theme} scene={scene} copy={copy}
          milestone={milestone && isMilestone(milestone) ? milestone : null} closing={closing} shot={shot} size={size} board={params.get('board') === '1'}
          environment={device} onReady={then ? () => { window.setTimeout(() => setSwitched(true), 1000); } : undefined} />
      </div>
      <div className="lf-mentor-layout-panel">
        <h1 data-copy-role="data">{MENTOR_NAMES[character]}</h1>
        <p data-copy-role="body">{copy.states[resolveMentorPose({ state, ageBand, milestone: milestone && isMilestone(milestone) ? milestone : null }).state]}</p>
      </div>
    </main>
  </div>;
}
