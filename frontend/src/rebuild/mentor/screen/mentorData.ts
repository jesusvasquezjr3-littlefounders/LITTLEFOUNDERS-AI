import { parseMasteryEvidence, type MasteryEvidence } from '../MentorDecisions';
import {
  getMap, getMastery, getNotebook, getPlan, getTranscript, listSessions,
  type TutorMapResponse, type TutorNotebookEntry, type TutorPlan,
} from '../session/tutorApi';
import type { SessionSummary, SessionTranscript, TutorWhiteboardWire } from '../session/types';

/*
 * What the Mentor screen's secondary views read from Core (T1e-T1g), as one
 * small interface: the real route binds it to the signed-in learner's token,
 * the development preview and the tests hand it fixtures. Each read answers
 * null when Core could not, so every view has an honest error state rather
 * than an empty one that looks like "nothing yet".
 */

/** The last conversation, as the notebook recaps it: how long, what it earned, its last board. */
export interface MentorRecap { minutes: number; xp: number; board: TutorWhiteboardWire | null }

export interface MentorNotebook {
  plan: TutorPlan | null;
  entries: TutorNotebookEntry[];
  recap: MentorRecap | null;
}

export interface MentorData {
  /** The learning map (T1f): the knowledge-component graph as this learner sees it. */
  map(): Promise<TutorMapResponse | null>;
  /** What the Mentor decided about this learner, and on what evidence (Appendix D §2.6), read-only in the map sheet. */
  mastery(): Promise<MasteryEvidence | null>;
  /** The plan and the kept boards (T1g), with a recap of the last conversation. */
  notebook(): Promise<MentorNotebook | null>;
  /** Past conversations, newest first (T1e). */
  sessions(): Promise<SessionSummary[] | null>;
  /** One past conversation, to replay it (T1e). */
  transcript(sessionId: string): Promise<SessionTranscript | null>;
}

/** Whole minutes, rounded down: "0 min" for a talk under a minute is the honest reading. */
export function minutesBetween(startIso: string, endIso: string | null): number {
  if (!endIso) return 0;
  return Math.max(0, Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));
}

export function coreMentorData(getToken: () => Promise<string | null>): MentorData {
  const withToken = async <T>(read: (token: string) => Promise<T | null>): Promise<T | null> => {
    const token = await getToken();
    return token ? read(token) : null;
  };
  return {
    map: () => withToken(async (token) => (await getMap(token)).data),
    mastery: () => withToken(async (token) => parseMasteryEvidence((await getMastery(token)).data)),
    notebook: () => withToken(async (token) => {
      const [plan, notebook] = await Promise.all([getPlan(token), getNotebook(token)]);
      if (!plan.data || !notebook.data) return null;
      /*
       * The recap is best-effort and separate: a learner with no finished
       * conversation, or a transcript that cannot be read right now, still has
       * a good plan and notebook to look at.
       */
      let recap: MentorRecap | null = null;
      const latest = (await listSessions(token)).data?.sessions[0];
      if (latest?.endedAt) {
        const transcript = await getTranscript(token, latest.id);
        if (transcript.data) {
          const last = [...transcript.data.turns].reverse().find((turn) => turn.whiteboard != null);
          recap = { minutes: minutesBetween(latest.startedAt, latest.endedAt), xp: latest.xpAwarded, board: last?.whiteboard ?? null };
        }
      }
      return { plan: plan.data.plan, entries: notebook.data.entries, recap };
    }),
    sessions: () => withToken(async (token) => (await listSessions(token)).data?.sessions ?? null),
    transcript: (sessionId) => withToken(async (token) => (await getTranscript(token, sessionId)).data),
  };
}
