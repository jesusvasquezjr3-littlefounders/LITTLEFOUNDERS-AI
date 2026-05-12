import { useCallback, useState } from 'react';
import type { PlayerProgress, AchievementId, SkinId, ThemeId } from '../types';

const STORAGE_KEY = 'namvsyum_progress';

const DEFAULT_PROGRESS: PlayerProgress = {
  playerLevel: 1,
  totalXp: 0,
  coins: 0,
  totalGamesPlayed: 0,
  totalItemsSorted: 0,
  maxComboEver: 0,
  highestLevelReached: 1,
  totalTimePlayedMs: 0,
  accuracyNumerator: 0,
  accuracyDenominator: 0,
  achievements: {
    firstSteps: { unlocked: false, progress: 0 },
    sorterApprentice: { unlocked: false, progress: 0 },
    sorterExpert: { unlocked: false, progress: 0 },
    sorterMaster: { unlocked: false, progress: 0 },
    comboStarter: { unlocked: false, progress: 0 },
    comboWarrior: { unlocked: false, progress: 0 },
    comboLegend: { unlocked: false, progress: 0 },
    perfectLevel: { unlocked: false, progress: 0 },
    highScorer: { unlocked: false, progress: 0 },
    scoreChampion: { unlocked: false, progress: 0 },
    scoreLegend: { unlocked: false, progress: 0 },
    survivor: { unlocked: false, progress: 0 },
    speedDemon: { unlocked: false, progress: 0 },
    mentorStudent: { unlocked: false, progress: 0 },
    easterEggHunter: { unlocked: false, progress: 0 },
    powerUpUser: { unlocked: false, progress: 0 },
    bombDefuser: { unlocked: false, progress: 0 },
    goldenTouch: { unlocked: false, progress: 0 },
    konamiMaster: { unlocked: false, progress: 0 },
  },
  equippedVitalioSkin: 'classic',
  equippedCaprichoSkin: 'classic',
  equippedTheme: 'sky',
  unlockedSkins: ['classic'],
  unlockedThemes: ['sky'],
};

function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlayerProgress;
      // Merge with defaults to handle new fields
      return { ...DEFAULT_PROGRESS, ...parsed, achievements: { ...DEFAULT_PROGRESS.achievements, ...parsed.achievements } };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_PROGRESS };
}

function saveProgress(progress: PlayerProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function usePlayerProgress() {
  const [progress, setProgress] = useState<PlayerProgress>(loadProgress);

  const addXp = useCallback((amount: number) => {
    setProgress((prev) => {
      let newXp = prev.totalXp + amount;
      let newLevel = prev.playerLevel;
      while (newXp >= xpForLevel(newLevel)) {
        newXp -= xpForLevel(newLevel);
        newLevel++;
      }
      const next = { ...prev, totalXp: newXp, playerLevel: newLevel };
      saveProgress(next);
      return next;
    });
  }, []);

  const addCoins = useCallback((amount: number) => {
    setProgress((prev) => {
      const next = { ...prev, coins: prev.coins + amount };
      saveProgress(next);
      return next;
    });
  }, []);

  const spendCoins = useCallback((amount: number): boolean => {
    let success = false;
    setProgress((prev) => {
      if (prev.coins < amount) return prev;
      success = true;
      const next = { ...prev, coins: prev.coins - amount };
      saveProgress(next);
      return next;
    });
    return success;
  }, []);

  const recordGameEnd = useCallback((score: number, itemsSorted: number, maxCombo: number, level: number, durationMs: number, correct: number, total: number) => {
    setProgress((prev) => {
      const newMaxCombo = Math.max(prev.maxComboEver, maxCombo);
      const newHighestLevel = Math.max(prev.highestLevelReached, level);
      const coinsEarned = Math.floor(score / 100);
      const next = {
        ...prev,
        totalGamesPlayed: prev.totalGamesPlayed + 1,
        totalItemsSorted: prev.totalItemsSorted + itemsSorted,
        maxComboEver: newMaxCombo,
        highestLevelReached: newHighestLevel,
        totalTimePlayedMs: prev.totalTimePlayedMs + durationMs,
        accuracyNumerator: prev.accuracyNumerator + correct,
        accuracyDenominator: prev.accuracyDenominator + total,
        coins: prev.coins + coinsEarned,
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const unlockAchievement = useCallback((id: AchievementId) => {
    setProgress((prev) => {
      const ach = prev.achievements[id];
      if (ach?.unlocked) return prev;
      const next = {
        ...prev,
        achievements: {
          ...prev.achievements,
          [id]: { ...ach, unlocked: true, unlockedAt: new Date().toISOString() },
        },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const updateAchievementProgress = useCallback((id: AchievementId, newProgress: number) => {
    setProgress((prev) => {
      const ach = prev.achievements[id];
      if (!ach || ach.unlocked) return prev;
      const next = {
        ...prev,
        achievements: {
          ...prev.achievements,
          [id]: { ...ach, progress: newProgress },
        },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const equipSkin = useCallback((monster: 'vitalio' | 'capricho', skin: SkinId) => {
    setProgress((prev) => {
      if (!prev.unlockedSkins.includes(skin)) return prev;
      const next = monster === 'vitalio'
        ? { ...prev, equippedVitalioSkin: skin }
        : { ...prev, equippedCaprichoSkin: skin };
      saveProgress(next);
      return next;
    });
  }, []);

  const equipTheme = useCallback((theme: ThemeId) => {
    setProgress((prev) => {
      if (!prev.unlockedThemes.includes(theme)) return prev;
      const next = { ...prev, equippedTheme: theme };
      saveProgress(next);
      return next;
    });
  }, []);

  const unlockSkin = useCallback((skin: SkinId) => {
    setProgress((prev) => {
      if (prev.unlockedSkins.includes(skin)) return prev;
      const next = { ...prev, unlockedSkins: [...prev.unlockedSkins, skin] };
      saveProgress(next);
      return next;
    });
  }, []);

  const unlockTheme = useCallback((theme: ThemeId) => {
    setProgress((prev) => {
      if (prev.unlockedThemes.includes(theme)) return prev;
      const next = { ...prev, unlockedThemes: [...prev.unlockedThemes, theme] };
      saveProgress(next);
      return next;
    });
  }, []);

  const xpToNextLevel = xpForLevel(progress.playerLevel);

  const accuracy = progress.accuracyDenominator > 0
    ? Math.round((progress.accuracyNumerator / progress.accuracyDenominator) * 100)
    : 0;

  return {
    progress,
    addXp,
    addCoins,
    spendCoins,
    recordGameEnd,
    unlockAchievement,
    updateAchievementProgress,
    equipSkin,
    equipTheme,
    unlockSkin,
    unlockTheme,
    xpToNextLevel,
    accuracy,
  };
}
