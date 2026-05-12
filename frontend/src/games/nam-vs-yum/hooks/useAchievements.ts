import { useCallback } from 'react';
import type { AchievementId, GameState } from '../types';
import { ACHIEVEMENTS } from '../constants';

export interface AchievementCheckResult {
  newlyUnlocked: AchievementId[];
  progressUpdates: { id: AchievementId; progress: number }[];
}

export function useAchievements() {
  const checkAchievements = useCallback((
    state: GameState,
    totalItemsSorted: number,
    maxComboEver: number,
    highestLevelReached: number,
    powerUpsUsed: number,
    bombsDefused: number,
    goldenCollected: number,
    mentorTipsReceived: number,
    easterEggTriggered: boolean,
    konamiTriggered: boolean,
  ): AchievementCheckResult => {
    const newlyUnlocked: AchievementId[] = [];
    const progressUpdates: { id: AchievementId; progress: number }[] = [];

    const check = (id: AchievementId, condition: boolean, progress: number) => {
      progressUpdates.push({ id, progress });
      if (condition) newlyUnlocked.push(id);
    };

    // First steps
    check('firstSteps', totalItemsSorted >= 1, Math.min(totalItemsSorted, 1));

    // Sorter achievements
    check('sorterApprentice', totalItemsSorted >= 50, Math.min(totalItemsSorted, 50));
    check('sorterExpert', totalItemsSorted >= 500, Math.min(totalItemsSorted, 500));
    check('sorterMaster', totalItemsSorted >= 2000, Math.min(totalItemsSorted, 2000));

    // Combo achievements
    const currentCombo = state.comboMultiplier;
    check('comboStarter', currentCombo >= 2, Math.min(currentCombo, 2));
    check('comboWarrior', currentCombo >= 5, Math.min(currentCombo, 5));
    check('comboLegend', state.combo >= 50, Math.min(state.combo, 50));

    // Perfect level
    check('perfectLevel', state.perfectLevelStreak >= 1, Math.min(state.perfectLevelStreak, 1));

    // Score achievements
    check('highScorer', state.score >= 1000, Math.min(state.score, 1000));
    check('scoreChampion', state.score >= 5000, Math.min(state.score, 5000));
    check('scoreLegend', state.score >= 10000, Math.min(state.score, 10000));

    // Survivor
    check('survivor', state.level >= 10, Math.min(state.level, 10));

    // Speed demon (checked externally via timer)
    // We'll leave progress as-is

    // Mentor student
    check('mentorStudent', mentorTipsReceived >= 20, Math.min(mentorTipsReceived, 20));

    // Easter egg
    check('easterEggHunter', easterEggTriggered, easterEggTriggered ? 1 : 0);

    // Power up user
    check('powerUpUser', powerUpsUsed >= 10, Math.min(powerUpsUsed, 10));

    // Bomb defuser
    check('bombDefuser', bombsDefused >= 5, Math.min(bombsDefused, 5));

    // Golden touch
    check('goldenTouch', goldenCollected >= 10, Math.min(goldenCollected, 10));

    // Konami
    check('konamiMaster', konamiTriggered, konamiTriggered ? 1 : 0);

    return { newlyUnlocked, progressUpdates };
  }, []);

  return { checkAchievements, achievements: ACHIEVEMENTS };
}
