import { useEffect, type ReactNode } from 'react';
import type { Locale } from '../../design/copyBudget';
import { MENTOR_NAMES } from '../../design/controls';
import en from '../../../i18n/en-US/rebuild-mentor.json';
import es from '../../../i18n/es-MX/rebuild-mentor.json';
import pt from '../../../i18n/pt-BR/rebuild-mentor.json';
import { MentorScreen, type MentorCopy, type MentorSheet } from './MentorScreen';
import { useMentorSession } from './useMentorSession';

/** The Mentor namespace (`rebuild-mentor.json`) in one locale. */
export function mentorCopy(locale: Locale): MentorCopy {
  return (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en) as MentorCopy;
}

/*
 * The Mentor screen on its real route (`/tutor`): the session controller and
 * the screen. The route file supplies what only the application knows (the
 * signed-in account, its language and mode, whether a guardian link exists,
 * the guided-review link, navigation) so nothing here reaches the legacy app.
 */
export function MentorRoute({ header, getToken, userId, locale, theme, guardianLink, reviewSkill, reviewLessonId = null, onLeave, onPath, initialSheet = null }: {
  header?: ReactNode;
  getToken: () => Promise<string | null>;
  userId: string | null;
  locale: Locale;
  theme: 'light' | 'dark';
  guardianLink: boolean;
  reviewSkill: string | null;
  /** OD-43: the lesson a guided review was opened from, or null. */
  reviewLessonId?: string | null;
  onLeave: () => void;
  onPath: () => void;
  /** Bible 08 §8 (GAP-FIX-R1): the profile's "Change" opens the screen with the chooser sheet up. */
  initialSheet?: MentorSheet | null;
}) {
  const session = useMentorSession({ getToken, userId, reviewSkill, reviewLessonId });
  const copy = mentorCopy(locale);
  // The title is the character's name once Core has said which one (08 §2); "Mentor" before that.
  const title = session.known ? MENTOR_NAMES[session.character] : copy.mentorScreen.documentTitle;
  useEffect(() => { document.title = `${title} · LittleFounders`; }, [title]);
  return <MentorScreen header={header} session={session} copy={copy} locale={locale} theme={theme} guardianLink={guardianLink} onLeave={onLeave} onPath={onPath} initialSheet={initialSheet} />;
}

