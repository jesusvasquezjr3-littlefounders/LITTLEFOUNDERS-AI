import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';

/*
 * "Your streak just went up." A STAGE PILL, same material as
 * `SoundBlockedNotice` (`StageShell.tsx`) and for the same reason: this is a
 * chip floating in front of the scene, not a plate the learner reads
 * through, and it rides the dock's own `above` column as an ordinary flex
 * child rather than a hand-measured fixed position.
 *
 * IT IS NOT `StreakCelebration.tsx` (lesson-engine/player). That one is a
 * `fixed inset-0` takeover with a scrim, built for a results screen where
 * blocking the page is the point. `HudDisclosure.tsx`'s own doctrine forbids
 * exactly that shape here — no scrim, ever, because the tutor keeps talking
 * and the microphone must stay reachable — so this reuses only the loose
 * `lf-streak-*` keyframes (`index.css`), never the modal component itself.
 *
 * Dismissed by a tap, same as `SoundBlockedNotice`, and never on a bare
 * timeout: a learner mid-sentence when this appears must not have it vanish
 * before they have looked at it.
 */
export interface GamificationCelebrationProps {
  streakDays: number;
  onDismiss: () => void;
}

export function GamificationCelebration({ streakDays, onDismiss }: GamificationCelebrationProps) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none flex w-full justify-center" role="status">
      <button
        type="button"
        onClick={onDismiss}
        className="lf-press lf-stage-pill pointer-events-auto flex max-w-[min(92vw,26rem)] items-center gap-2 px-4 py-2 text-left"
      >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
          <span
            aria-hidden
            className="lf-streak-ring absolute h-5 w-5 rounded-full border-2 border-warning/50"
          />
          <Icon
            name="local_fire_department"
            className="relative !text-[18px] text-warning-strong"
            aria-hidden
          />
        </span>
        <span key={streakDays} className="lf-streak-number lf-caption font-bold text-warning-strong">
          {t('tutor.gamification.streakCelebration', { count: streakDays })}
        </span>
      </button>
    </div>
  );
}
