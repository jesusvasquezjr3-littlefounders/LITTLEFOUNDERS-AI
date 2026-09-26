import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { MENTOR_CHARACTERS, type MentorCharacter } from '@/rebuild/design/controls';

/*
 * The learner's chosen Mentor, for the learner shell's Mentor tab (OD-6: the
 * tab shows the chosen character's name and a render of the real model).
 *
 * Read from Core's GET /tutor/preferences, the same record the Mentor stage
 * saves. A character counts as CHOSEN only once the learner has saved a
 * preference (`personalized`): before that the stored character is a server
 * default nobody picked, and the tab says "Mentor" with no picture. Any
 * failure is "not chosen" too — never a stand-in character.
 *
 * One request per signed-in account and shell mount (the shell remounts when
 * a learner comes back from the full-screen Mentor stage, where the choice is
 * made), the last answer shown meanwhile.
 */
const remembered = new Map<string, MentorCharacter | null>();

function parse(value: unknown): MentorCharacter | null {
  const data = value as { character?: unknown; personalized?: unknown } | null;
  if (!data || data.personalized !== true) return null;
  return (MENTOR_CHARACTERS as readonly unknown[]).includes(data.character) ? data.character as MentorCharacter : null;
}

export function useMentorCharacter(enabled: boolean): MentorCharacter | null {
  const { session, getToken } = useAuth();
  const userId = session?.user?.id ?? null;
  const [character, setCharacter] = useState<MentorCharacter | null>(() => (userId ? remembered.get(userId) ?? null : null));
  useEffect(() => {
    if (!enabled || !userId) { setCharacter(null); return; }
    setCharacter(remembered.get(userId) ?? null);
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      const result = await api<unknown>('/tutor/preferences', { token });
      const next = result.error ? null : parse(result.data);
      remembered.set(userId, next);
      if (!cancelled) setCharacter(next);
    })();
    return () => { cancelled = true; };
  }, [enabled, userId, getToken]);
  return character;
}
