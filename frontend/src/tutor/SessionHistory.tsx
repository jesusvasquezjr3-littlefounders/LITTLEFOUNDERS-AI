import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CharacterActor } from '@/components/characters/control/CharacterActor';
import { HudPlate } from './hud/HudPlate';
import { listSessions } from './tutorApi';
import type { SessionSummary } from './types';

/*
 * THE ARCHIVE — the list you choose a conversation FROM, and nothing else.
 *
 * WHAT THIS FILE STOPPED BEING. It used to be the replay itself: press "Play it
 * again" and the row expanded into a stack of `<p>`s, one per line, with a
 * native `<audio controls>` widget beside every tutor turn. Its own comment
 * claimed the character "re-acts each line with the emotion and action it
 * originally carried"; nothing re-acted anything, and /ORACLE.md §12 had
 * already been amended to say so in as many words. The owner's report was
 * exact: "no se ven fluidas e inmersivas como una sesion con tutor natural,
 * debe sentirse como una repeticion".
 *
 * The performance moved to the stage, where a performance belongs
 * (`replay/ReplayInWorld.tsx`, driven by `replay/useReplayDirector.ts`). What
 * is left here is the ONE job a list is genuinely good at: letting a learner
 * point at the conversation they mean. So a row is a poster for a performance —
 * who it was with, when, and how much of it there is — and pressing it hands
 * the session id upward and leaves.
 *
 * IT IS THE THING THAT LEAVES THE LIST, WHICH IS WHY `onReplay` IS REQUIRED.
 * Only the component that owns the phase can move to it, and a fallback that
 * quietly rendered the old transcript when no handler was passed would be
 * exactly the arrangement that let a list survive as a feature: two replays in
 * the codebase, one of them the one nobody reviews.
 *
 * AND IT IS PLAIN IN THE MATERIAL'S SENSE. Every row used to be a `Card` —
 * Liquid Glass, `blur(20px)`, a five-layer atmospheric shadow — mounted inside
 * a Lumen sheet, which is glass stacked on glass and is forbidden outright
 * (/DESIGN.md §Elevation, rule 6). The rows are rows: a hairline between them,
 * nothing painted, the sheet underneath doing the only work a surface has to do
 * here.
 */

export interface SessionHistoryProps {
  token: string;
  /**
   * Play this one, on the island.
   *
   * The whole summary travels rather than just the id, because the phase above
   * needs the character and the diorama on the FIRST frame — a replay that
   * opened on the default island and then swapped to the right one the moment
   * the transcript landed would make the learner watch their own memory
   * correct itself.
   */
  onReplay: (session: SessionSummary) => void;
}

export function SessionHistory({ token, onReplay }: SessionHistoryProps) {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listSessions(token).then((result) => {
      if (!cancelled) setSessions(result.data?.sessions ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (sessions === null) {
    return <p className="lf-body text-content-muted">{t('tutor.history.loading')}</p>;
  }

  if (sessions.length === 0) {
    return <p className="lf-body text-content-muted">{t('tutor.history.empty')}</p>;
  }

  const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <ul className="divide-y divide-content/10">
      {sessions.map((session) => (
        <li key={session.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-10 w-10 shrink-0">
                <CharacterActor
                  character={session.character}
                  emotion="neutral"
                  size="fill"
                  enableMouseTracking={false}
                />
              </span>
              <div className="min-w-0">
                <p className="lf-title text-content">
                  {t(`tutor.intent.${session.intent}`, { defaultValue: session.intent })}
                </p>
                {/*
                  WHAT IS IN IT, not what it scored. The date answers "which one
                  was that", the line count answers "how long is this going to
                  be", and both are questions a learner actually has with their
                  finger over the button. XP joins them only when there is any:
                  a zero on a row is a mark against a conversation that may have
                  been the best one they had.
                */}
                <p className="lf-caption text-content-muted">
                  {formatter.format(new Date(session.startedAt))}
                  {` · ${t('tutor.history.lines', { count: session.turnCount })}`}
                  {session.segmentCount > 0 &&
                    ` · ${t('tutor.history.activityCount', { count: session.segmentCount })}`}
                  {session.xpAwarded > 0 && ` · ${t('tutor.history.xp', { count: session.xpAwarded })}`}
                </p>
              </div>
            </div>

            <HudPlate
              as="button"
              shape="chip"
              /*
               * The character and the date are in the accessible name because
               * "Play it again" on eight adjacent rows is eight identical
               * controls to anybody navigating by name. The visible label comes
               * first so voice control still reaches it by what is written on
               * it.
               */
              aria-label={`${t('tutor.history.replay')}: ${t(
                `tutor.character.${session.character}.name`,
              )}, ${formatter.format(new Date(session.startedAt))}`}
              onClick={() => onReplay(session)}
              className="shrink-0"
            >
              <span className="lf-action">{t('tutor.history.replay')}</span>
            </HudPlate>
          </div>
        </li>
      ))}
    </ul>
  );
}
