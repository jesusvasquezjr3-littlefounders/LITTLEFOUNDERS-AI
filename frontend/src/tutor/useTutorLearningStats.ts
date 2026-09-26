import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { crossedStreakMilestone } from '@/rebuild/design/milestones';

interface ProfileLearningStats {
  xpPoints: number;
  streakDays: number;
}

interface ProfileResponse {
  learningStats: ProfileLearningStats;
}

export interface TutorLearningStats {
  xpPoints: number;
  streakDays: number;
  loading: boolean;
  /**
   * True from the moment a fetch finds the streak longer than the last time
   * this learner opened the Tutor, until `dismissStreakCelebration` is
   * called. See the module doc below for why the streak — and only the
   * streak — drives this.
   */
  streakJustAdvanced: boolean;
  dismissStreakCelebration: () => void;
}

/*
 * The Tutor's own read of /profile's learning stats (racha + XP) — the same
 * endpoint ProfilePage.tsx already calls, not a new one. Fetched once, on
 * mount: the streak is a once-a-day server number, so a once-per-mount read
 * is already the truth, and re-fetching on a timer to catch a same-session
 * change would be a cost with nothing behind it.
 *
 * TAKES `token`/`userId` RATHER THAN CALLING `useAuth()` ITSELF, on purpose.
 * This hook is meant to be used from `ConversationView.tsx`, which has never
 * depended on `AuthContext` and is unit-tested standalone (see
 * `conversationView.test.tsx`, which renders it with no provider tree at
 * all). `TutorExperience.tsx` already resolves both values once, the same
 * way `token`/`awaitingReply` and the rest of `ConversationLayerProps` are
 * "owned upstream" — see that file's own comment on `awaitingReply` for why
 * a value two layers show is computed once above them rather than
 * rediscovered in each.
 *
 * THE ONLY CELEBRATION TRIGGER IS THE STREAK CROSSING A MILESTONE (7, 30 OR
 * 100 DAYS, OD-7) SINCE THE LAST TIME THIS LEARNER OPENED THE TUTOR, compared
 * against a per-user localStorage
 * mark (`lf.tutor.lastSeenStreak.<userId>`, same shape as
 * `SESSION_LIMIT_KEY_PREFIX` in TutorExperience.tsx). Not XP: XP grows on
 * almost every turn, so celebrating it here would fire every session and
 * stop meaning anything inside a minute.
 */
const LAST_SEEN_STREAK_KEY_PREFIX = 'lf.tutor.lastSeenStreak.';

function readLastSeenStreak(userId: string | undefined): number | null {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_STREAK_KEY_PREFIX + userId);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function rememberSeenStreak(userId: string | undefined, streakDays: number): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(LAST_SEEN_STREAK_KEY_PREFIX + userId, String(streakDays));
  } catch {
    // Private browsing, a blocked origin, a full quota — never worth failing a session over.
  }
}

export function useTutorLearningStats(
  token: string | null | undefined,
  userId: string | undefined,
): TutorLearningStats {
  const [xpPoints, setXpPoints] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [streakJustAdvanced, setStreakJustAdvanced] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      const res = await api<ProfileResponse>('/profile', { token });
      if (cancelled) return;
      setLoading(false);
      if (res.error) return;

      const stats = res.data.learningStats;
      setXpPoints(stats.xpPoints);
      setStreakDays(stats.streakDays);

      const lastSeen = readLastSeenStreak(userId);
      // B.20 / OD-7 (S05.3e): only crossing the 7-, 30- or 100-day mark since
      // the learner last opened the Mentor celebrates. Any other increase is
      // an ordinary practised day and shows as the number alone.
      if (crossedStreakMilestone(lastSeen, stats.streakDays) !== null) {
        setStreakJustAdvanced(true);
      }
      rememberSeenStreak(userId, stats.streakDays);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  const dismissStreakCelebration = useCallback(() => setStreakJustAdvanced(false), []);

  return { xpPoints, streakDays, loading, streakJustAdvanced, dismissStreakCelebration };
}
