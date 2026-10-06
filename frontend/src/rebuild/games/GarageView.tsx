import { Button, MentorAvatar, PictureChoice, SegmentedControl, Switch } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { findMentorAvatar } from '../design/assets';
import { gamesCopy } from './gamesCopy';
import { CIRCUITS, MENTORS, MENTOR_NAMES, MODES, SPEEDS, type GarageSelection, type Mentor } from './vocabulary';
import './games.css';

/*
 * The Garage: where the learner picks a circuit, a mode, a driver and a speed
 * class before the one big "Go" (KRV1-CONTRACT §6). The game has no menus in
 * the embed, so every choice is made here, in the design system.
 *
 * The page is the learner's Mentor first: their real render and one line in
 * their voice (the Mentor screen is the stage, but the Garage is still theirs).
 * Circuits and drivers are PICTURE choices whose labels are NAMES, not copy
 * (a proper noun is `data`, the way a course title is): the four drivers are
 * the same four Mentors as real renders (02 rule 21), never a letter or a
 * look-alike. Nothing here shows a time, a rank or a reward: a Garage is a
 * place to choose, and the pick that counts is the learner's own.
 *
 * Presentation only: the host owns the selection and starting the visit.
 */

export interface GarageViewProps {
  locale: Locale;
  dark: boolean;
  /** Who speaks: the learner's own Mentor. */
  mentor: Mentor;
  selection: GarageSelection;
  muted: boolean;
  onSelect: (patch: Partial<GarageSelection>) => void;
  onMuted: (muted: boolean) => void;
  onGo: () => void;
}

export function GarageView({ locale, dark, mentor, selection, muted, onSelect, onMuted, onGo }: GarageViewProps) {
  const t = gamesCopy[locale];
  const avatar = findMentorAvatar(mentor, dark ? 'dark' : 'light');
  return <section className="lf-play-garage" data-screen="play-garage" aria-labelledby="lf-play-title">
    <div className="lf-play-mentor" data-character={mentor}>
      {avatar ? <MentorAvatar renderId={avatar} label={MENTOR_NAMES[mentor]} size="lg" /> : null}
      <p data-copy-role="mentor">{t.gameGarage.greeting[mentor]}</p>
    </div>
    <div className="lf-play-column">
      <div className="lf-play-circuits">
        <PictureChoice legend={t.gameGarage.circuitLegend} name="lf-play-circuit" value={selection.circuit}
          onValueChange={(circuit) => onSelect({ circuit })}
          options={CIRCUITS.map((circuit) => ({
            value: circuit, label: t.gameGarage.circuits[circuit],
            picture: <span className="lf-play-name" data-copy-role="data">{t.gameGarage.circuits[circuit]}</span>,
          }))} />
      </div>
      <SegmentedControl legend={t.gameGarage.modeLegend} name="lf-play-mode" value={selection.mode} onValueChange={(mode) => onSelect({ mode })}
        options={MODES.map((mode) => ({ value: mode, label: t.gameGarage.modes[mode] }))} />
    </div>
    <div className="lf-play-column">
      <div className="lf-play-drivers">
        <PictureChoice legend={t.gameGarage.driverLegend} name="lf-play-driver" value={selection.driver}
          onValueChange={(driver) => onSelect({ driver })}
          options={MENTORS.map((driver) => {
            const render = findMentorAvatar(driver, dark ? 'dark' : 'light');
            return {
              value: driver, label: MENTOR_NAMES[driver],
              picture: <span className="lf-play-driver">
                {render ? <MentorAvatar renderId={render} label={null} size="sm" /> : null}
                <span className="lf-play-name" data-copy-role="data">{MENTOR_NAMES[driver]}</span>
              </span>,
            };
          })} />
      </div>
      <SegmentedControl legend={t.gameGarage.speedLegend} name="lf-play-speed" value={selection.speed} onValueChange={(speed) => onSelect({ speed })}
        options={SPEEDS.map((speed) => ({ value: speed, label: t.gameGarage.speeds[speed] }))} />
      <Switch label={t.gamePlay.sound} checked={!muted} onCheckedChange={(on) => onMuted(!on)}
        stateLabels={{ on: t.gamePlay.soundOn, off: t.gamePlay.soundOff }} />
    </div>
    <div className="lf-play-go">
      <Button variant="accent" size="lg" breathing onClick={onGo}>{t.gameGarage.go}</Button>
    </div>
  </section>;
}
