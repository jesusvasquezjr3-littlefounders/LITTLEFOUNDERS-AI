import {
  List, ListRow, MENTOR_CHARACTERS, MENTOR_NAMES, MentorAvatar, Pill, useRebuildEnvironment, type MentorCharacter,
} from '../design/controls';
import { findMentorAvatar } from '../design/assets';
import { findChooserStill } from './stageStills';
import './mentorChooser.css';

/*
 * THE MENTOR CHOOSER, ONE COMPONENT FOR EVERY SURFACE (Frontend Bible 08 §8;
 * 07 §4; OD-6). "The chooser shows the four real characters on the Diorama,
 * rendered from the models": each row leads with the character standing on
 * its Diorama in the idle pose (`mentor.chooserStill`), with its name and one
 * line of at most six words. Where no Diorama render is registered it falls
 * back to the character's avatar render, never a stand-in, a letter or a
 * look-alike (02 rule 21).
 *
 * Used by the first-run onboarding (identity/OnboardingFlow.tsx, the 'mentor'
 * step, where most learners choose) and by the Mentor screen's chooser sheet.
 * The caller owns saving: this component only reports the press and shows the
 * chosen and saving states it is given.
 */

export interface MentorChooserProps {
  /** The list's accessible name (the surface's heading). */
  label: string;
  /** One line per character, at most six words (Copy Budget `body`). */
  lines: Record<MentorCharacter, string>;
  chosen: MentorCharacter | null;
  saving: MentorCharacter | null;
  chosenLabel: string;
  savingLabel: string;
  /** The chosen pill's tone: the surface's own success or brand colour. */
  chosenTone?: 'primary' | 'success';
  /** No press while a save is in flight (or the surface is otherwise busy). */
  disabled?: boolean;
  onChoose: (character: MentorCharacter) => void;
}

export function MentorChooser({ label, lines, chosen, saving, chosenLabel, savingLabel, chosenTone = 'primary', disabled = false, onChoose }: MentorChooserProps) {
  const { theme } = useRebuildEnvironment();
  const locked = disabled || saving !== null;
  return <div className="lf-mentor-chooser" data-component="mentor-chooser">
    <List label={label}>
      {MENTOR_CHARACTERS.map((character) => {
        const still = findChooserStill(character, theme);
        const avatar = still ? null : findMentorAvatar(character, theme);
        return <ListRow key={character} title={MENTOR_NAMES[character]} titleRole="data" supporting={lines[character]}
          leading={still
            ? <img className="lf-mentor-chooser-still" src={still.path} alt="" data-asset-id={still.id} data-character={character} />
            : avatar ? <MentorAvatar renderId={avatar} label={null} size="md" /> : null}
          trailing={chosen === character ? <Pill tone={chosenTone}>{chosenLabel}</Pill>
            : saving === character ? <Pill tone="sky">{savingLabel}</Pill> : null}
          // The rows stay buttons while a save is in flight (focus does not jump); a press then does nothing.
          onPress={() => { if (!locked) onChoose(character); }} />;
      })}
    </List>
  </div>;
}
