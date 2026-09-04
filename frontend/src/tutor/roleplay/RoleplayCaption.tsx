import { useTranslation } from 'react-i18next';
import { HudPlate } from '@/tutor/hud/HudPlate';
import type { CharacterId } from '@/components/characters/control/types';
import type { RoleplayBeat } from './scenes';

/*
 * Class III / S17 `roleplay`: the caption for a scene beat, attributed to
 * whichever real character is speaking it — `scenes.ts`'s own header
 * explains why this reads a caption rather than plays audio. Deliberately
 * its own small plate rather than reusing `SpeechCaption.tsx`: that
 * component is wired to the ONE live `<audio>` element `TutorStage` owns
 * (word-timed reveal, `onSpeechEnd`), and a roleplay beat has no clip for it
 * to listen to — forcing it through that component would mean either a
 * second audio element (the exact thing `useReplayDirector.ts`'s own header
 * says this stage must never have) or teaching it a silent, timer-only mode
 * that every OTHER caller would have to keep not tripping.
 */
export function RoleplayCaption({
  titleKey,
  beat,
  speakerId,
}: {
  titleKey: string;
  beat: RoleplayBeat;
  /** Null when the beat's role (e.g. `companion`) has no real character standing in it. */
  speakerId: CharacterId | null;
}) {
  const { t } = useTranslation();
  return (
    <HudPlate shape="plate" density="reading" className="pointer-events-none">
      <span className="flex flex-col gap-1 text-center">
        <span className="lf-caption text-content-faint">{t(titleKey)}</span>
        <span className="lf-body text-content">
          {speakerId && <span className="lf-action text-primary">{t(`tutor.character.${speakerId}.name`)}: </span>}
          {t(beat.textKey)}
        </span>
      </span>
    </HudPlate>
  );
}
