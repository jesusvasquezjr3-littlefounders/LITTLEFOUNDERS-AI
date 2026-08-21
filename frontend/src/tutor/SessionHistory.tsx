import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Icon } from '@/components/ui';
import { CharacterActor } from '@/components/characters/control/CharacterActor';
import { getTranscript, listSessions } from './tutorApi';
import type { SessionSummary, SessionTranscript } from './types';

/*
 * Saved conversations, and their replay (/ORACLE.md §12).
 *
 * WHAT A REPLAY IS AND IS NOT. It reconstructs the session from the
 * transcript: the character re-acts each line with the emotion and action it
 * originally carried, and the tutor's stored audio plays. It is NOT a
 * recording of the learner — there is no such thing in this product, because
 * there is nowhere in the schema to put one (owner decision 8, migration
 * 0047).
 *
 * The list is deliberately plain. A learner looking for "the one about
 * saving" needs a date, a character and a topic — not a dashboard.
 */

export interface SessionHistoryProps {
  token: string;
}

export function SessionHistory({ token }: SessionHistoryProps) {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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
    <div className="space-y-3">
      {sessions.map((session) => (
        <Card key={session.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 shrink-0">
                <CharacterActor
                  character={session.character}
                  emotion="neutral"
                  size="fill"
                  enableMouseTracking={false}
                />
              </span>
              <div>
                <p className="lf-title text-content">
                  {t(`tutor.intent.${session.intent}`, { defaultValue: session.intent })}
                </p>
                <p className="lf-caption text-content-muted">
                  {formatter.format(new Date(session.startedAt))}
                  {session.xpAwarded > 0 && ` · ${t('tutor.history.xp', { count: session.xpAwarded })}`}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => setOpenId(openId === session.id ? null : session.id)}
            >
              {openId === session.id ? t('tutor.history.hide') : t('tutor.history.replay')}
            </Button>
          </div>

          {openId === session.id && <Replay token={token} sessionId={session.id} />}
        </Card>
      ))}
    </div>
  );
}

function Replay({ token, sessionId }: { token: string; sessionId: string }) {
  const { t } = useTranslation();
  const [transcript, setTranscript] = useState<SessionTranscript | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getTranscript(token, sessionId).then((result) => {
      if (cancelled) return;
      if (result.data) setTranscript(result.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [token, sessionId]);

  if (failed) return <p className="lf-body mt-4 text-content-muted">{t('tutor.history.loadFailed')}</p>;
  if (!transcript) return <p className="lf-body mt-4 text-content-muted">{t('tutor.history.loading')}</p>;

  return (
    <div className="mt-4 space-y-2 border-t border-outline pt-4">
      {transcript.turns.map((turn) => (
        <div key={turn.id} className="flex items-start gap-2">
          <p
            className={
              turn.speaker === 'tutor'
                ? 'lf-body flex-1 rounded-md bg-surface-sunken px-3 py-2 text-content'
                : 'lf-body ml-auto max-w-[80%] rounded-md bg-accent-soft px-3 py-2 text-content'
            }
          >
            {turn.text}
          </p>
          {turn.audio_path && (
            <audio
              controls
              preload="none"
              src={turn.audio_path}
              className="h-8 shrink-0"
              aria-label={t('tutor.history.playLine')}
            />
          )}
        </div>
      ))}

      {transcript.segments.length > 0 && (
        <div className="pt-2">
          <p className="lf-label mb-2 text-content">{t('tutor.history.activities')}</p>
          <ul className="space-y-1">
            {transcript.segments.map((segment) => (
              <li key={segment.segmentId} className="lf-body flex items-center gap-2 text-content-muted">
                <Icon name={segment.score !== null && segment.score >= 70 ? 'check_circle' : 'radio_button_unchecked'} />
                <span>
                  {String((segment.segment as { prompt_md?: string }).prompt_md ?? '').slice(0, 80)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
