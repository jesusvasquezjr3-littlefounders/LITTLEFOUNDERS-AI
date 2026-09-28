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
 */
export function MentorStagePreview({ locale, theme, ageBand, params }: {
  locale: Locale; theme: 'light' | 'dark'; ageBand: AgeBand; params: URLSearchParams;
}) {
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).mentorStage;
  const pick = <T extends string>(value: string | null, options: readonly T[], fallback: T): T =>
    (options as readonly string[]).includes(value ?? '') ? value as T : fallback;
  const character = pick<MentorCharacter>(params.get('character'), MENTOR_CHARACTERS, 'dina');
  const state = pick<MentorStageState>(params.get('state'), MENTOR_STAGE_STATES, 'idle');
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
          milestone={milestone && isMilestone(milestone) ? milestone : null} closing={closing} shot={shot} size={size} board={params.get('board') === '1'} />
      </div>
      <div className="lf-mentor-layout-panel">
        <h1 data-copy-role="data">{MENTOR_NAMES[character]}</h1>
        <p data-copy-role="body">{copy.states[resolveMentorPose({ state, ageBand, milestone: milestone && isMilestone(milestone) ? milestone : null }).state]}</p>
      </div>
    </main>
  </div>;
}
