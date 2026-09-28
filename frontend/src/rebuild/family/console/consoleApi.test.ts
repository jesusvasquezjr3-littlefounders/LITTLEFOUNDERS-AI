import { describe, expect, it } from 'vitest';
import {
  createChild, decideMemoryNote, fetchChildren, fetchKeptBoards, fetchMentorHistory, fetchMicrophone, fetchReachedGoal, fetchTerritory, fetchTranscript,
  boardWire, orderTranscript, plainPrompt, removeChild, setInsightsConsent,
} from './consoleApi';
import { FAMILY, fakeTransport, GOAL_BOARD, historyWire, KID_A, ok, refuse, SESSION_A, territoryWire, transcriptWire, YOUR_TURN_BOARD } from './consoleFixtures';
import { boardFixtures } from '../../mentor/screen/boardFixtures';

/*
 * W2F.1 client layer: every response is shape-checked (a surface never
 * renders a state Core did not return), refusals keep Core's code, and the
 * orderings the Tutor reads (flags, the transcript) follow the documented rules.
 */

describe('Family console API layer', () => {
  it('reads the family and refuses a malformed row rather than guessing', async () => {
    const good = await fetchChildren(fakeTransport({ 'GET /family/kids': ok({ kids: FAMILY }) }));
    expect(good.ok && good.data.map((child) => child.userId)).toEqual([KID_A, FAMILY[1]!.userId]);
    const bad = await fetchChildren(fakeTransport({ 'GET /family/kids': ok({ kids: [{ ...FAMILY[0], walletTotal: '34' }] }) }));
    expect(bad).toEqual({ ok: false, code: 'INVALID_RESPONSE' });
    const refused = await fetchChildren(fakeTransport({ 'GET /family/kids': refuse('PARENT_VERIFICATION_REQUIRED') }));
    expect(refused).toEqual({ ok: false, code: 'PARENT_VERIFICATION_REQUIRED' });
  });

  it('M-12: reads the hint-style-test mark as true only when Core says true (absent or malformed = false)', async () => {
    const read = async (value: unknown) => {
      const result = await fetchChildren(fakeTransport({ 'GET /family/kids': ok({ kids: [{ ...FAMILY[0], dialogueExperiment: value }] }) }));
      return result.ok ? result.data[0]!.dialogueExperiment : 'refused';
    };
    expect(await read(true)).toBe(true);
    expect(await read(false)).toBe(false);
    expect(await read(undefined)).toBe(false);
    expect(await read('yes')).toBe(false);
  });

  it('sends exactly the documented child fields and the consent verb for each direction', async () => {
    const transport = fakeTransport({
      'POST /family/kids': ok({ kid: { userId: KID_A, displayName: 'Ana', username: 'ana_2016' } }),
      [`POST /family/kids/${KID_A}/analytics-consent`]: ok({ kidId: KID_A, analyticsConsent: true }),
      [`DELETE /family/kids/${KID_A}/analytics-consent`]: ok({ kidId: KID_A, analyticsConsent: false }),
    });
    await createChild(transport, { displayName: 'Ana', username: 'ana_2016', passphrase: 'long enough', birthDate: null, locale: 'es-MX' });
    expect(transport.calls[0]).toEqual({ method: 'POST', path: '/family/kids',
      body: { displayName: 'Ana', username: 'ana_2016', passphrase: 'long enough', birthDate: null, locale: 'es-MX' } });
    expect((await setInsightsConsent(transport, KID_A, true)).ok).toBe(true);
    expect((await setInsightsConsent(transport, KID_A, false)).ok).toBe(true);
    expect(transport.calls.slice(1).map((call) => call.method)).toEqual(['POST', 'DELETE']);
  });

  it('tells a held removal (nothing deleted) from a completed one', async () => {
    const held = await removeChild(fakeTransport({ [`DELETE /family/kids/${KID_A}`]: ok({ deleted: false, status: 'held' }) }), KID_A);
    expect(held).toEqual({ ok: true, data: { deleted: false, status: 'held' } });
    const done = await removeChild(fakeTransport({ [`DELETE /family/kids/${KID_A}`]: ok({ deleted: true, status: 'finishing' }) }), KID_A);
    expect(done.ok && done.data.deleted).toBe(true);
    const lie = await removeChild(fakeTransport({ [`DELETE /family/kids/${KID_A}`]: ok({ deleted: true, status: 'held' }) }), KID_A);
    expect(lie.ok).toBe(false);
  });

  it('reads an absent or unknown microphone policy as blocked, never as permission', async () => {
    const absent = await fetchMicrophone(fakeTransport({ [`GET /tutor/consent/${KID_A}`]: ok({ active: false, grantedAt: null, locale: null }) }), KID_A);
    expect(absent.ok && absent.data.policy).toBe('blocked');
    const odd = await fetchMicrophone(fakeTransport({ [`GET /tutor/consent/${KID_A}`]: ok({ active: false, grantedAt: null, policy: 'maybe' }) }), KID_A);
    expect(odd.ok && odd.data.policy).toBe('blocked');
  });

  it('flattens the child\'s own tree into units of topics and keeps the course facts', async () => {
    const result = await fetchTerritory(fakeTransport({ [`GET /family/kids/${KID_A}/courses/money-basics/territory`]: ok(territoryWire()) }), KID_A, 'money-basics');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.units[0]!.topics.map((topic) => topic.state)).toEqual(['completed', 'in-progress', 'not-started', 'review-due']);
    expect(result.data.course.progress).toEqual({ passed: 3, total: 8 });
    expect(result.data.stats?.streakDays).toBe(5);
    const noStats = await fetchTerritory(fakeTransport({ [`GET /family/kids/${KID_A}/courses/x/territory`]: ok(territoryWire({ stats: null })) }), KID_A, 'x');
    expect(noStats.ok && noStats.data.stats).toBeNull();
  });

  it('offers only a reached goal for sharing', async () => {
    const goals = { goals: [{ id: 'g1', title: 'Kite', status: 'active' }, { id: 'g2', title: 'Bike', status: 'reached' }] };
    expect(await fetchReachedGoal(fakeTransport({ [`GET /tasks/${KID_A}/goals`]: ok(goals) }), KID_A)).toEqual({ ok: true, data: { id: 'g2', title: 'Bike' } });
    expect(await fetchReachedGoal(fakeTransport({ [`GET /tasks/${KID_A}/goals`]: ok({ goals: [] }) }), KID_A)).toEqual({ ok: true, data: null });
  });

  it('sorts both flag provenances in one list: severity first, then newest', async () => {
    const result = await fetchMentorHistory(fakeTransport({ [`GET /tutor/kids/${KID_A}/sessions`]: ok(historyWire()) }), KID_A);
    expect(result.ok && result.data.flags.map((flag) => `${flag.source}:${flag.severity}`)).toEqual(['session:high', 'placement:medium', 'session:low']);
  });

  it('asks for the next page by offset', async () => {
    const transport = fakeTransport({ [`GET /tutor/kids/${KID_A}/sessions?offset=30`]: ok(historyWire({ sessions: [] })) });
    await fetchMentorHistory(transport, KID_A, 30);
    expect(transport.calls[0]!.path).toBe(`/tutor/kids/${KID_A}/sessions?offset=30`);
  });

  it('interleaves turns and activities in the order they happened and carries no answer key', async () => {
    const result = await fetchTranscript(fakeTransport({ [`GET /tutor/sessions/${SESSION_A}`]: ok(transcriptWire()) }), SESSION_A);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((beat) => beat.kind)).toEqual(['mentor', 'child', 'activity', 'mentor', 'note']);
    expect(JSON.stringify(result.data)).not.toContain('answer');
    const mentor = result.data[0]!;
    // The full board wire travels on the beat (the Mentor lane draws it), with its caption as the fallback.
    expect(mentor.kind === 'mentor' && mentor.board).toEqual({ kind: 'goal_bar', label: 'Bike: 5 of 20', wire: GOAL_BOARD });
    const demo = result.data[3]!;
    expect(demo.kind === 'mentor' && demo.demonstrated).toEqual([10, -5]);
    const activity = result.data[2]!;
    expect(activity.kind === 'activity' && activity.prompt).toBe('How many more coins?');
  });

  it('orders turns by their own seq even when clocks disagree', () => {
    const turn = (id: string, seq: number, at: string) => ({ id, seq, speaker: 'tutor', text: id, created_at: at });
    const beats = orderTranscript([turn('b', 2, '2026-09-20T10:00:00Z'), turn('a', 1, '2026-09-20T10:00:09Z')], []);
    expect(beats?.map((beat) => beat.id)).toEqual(['turn:a', 'turn:b']);
  });

  it('strips light markdown to plain words without dropping any', () => {
    expect(plainPrompt('## Plan\nHow **many** _more_ `coins`?')).toBe('Plan How many more coins?');
  });

  it('reports a note decision as applied, stale (out of date or decided elsewhere) or failed', async () => {
    const answer = (code: string | null) => fakeTransport({ 'POST /tutor/memory-proposals/n1/decision': code ? refuse(code) : ok({ outcome: 'approved', applied: true }) });
    expect(await decideMemoryNote(answer(null), 'n1', 'approved')).toBe('approved');
    expect(await decideMemoryNote(answer('NOTE_OUT_OF_DATE'), 'n1', 'approved')).toBe('stale');
    expect(await decideMemoryNote(answer('ALREADY_DECIDED'), 'n1', 'rejected')).toBe('stale');
    expect(await decideMemoryNote(answer('DATA_UNAVAILABLE'), 'n1', 'approved')).toBe('failed');
  });

  it('keeps the plan and the kept boards with their wire when it can be drawn, and their captions always', async () => {
    const result = await fetchKeptBoards(fakeTransport({
      [`GET /tutor/kids/${KID_A}/plan`]: ok({ plan: { content: { ...GOAL_BOARD, label: 'Bike plan' }, sessionId: null, updatedAt: '2026-09-19T00:00:00Z' } }),
      [`GET /tutor/kids/${KID_A}/notebook`]: ok({ entries: [
        { id: 'k1', whiteboard: { kind: 'tally', label: '' }, sessionId: null, turnSeq: null, keptAt: '2026-09-18T00:00:00Z' },
        { id: 'k2', whiteboard: YOUR_TURN_BOARD, sessionId: null, turnSeq: null, keptAt: '2026-09-19T00:00:00Z' },
      ] }),
    }), KID_A);
    expect(result.ok && result.data.plan?.board).toEqual({ kind: 'goal_bar', label: 'Bike plan', wire: { ...GOAL_BOARD, label: 'Bike plan' } });
    expect(result.ok && result.data.kept.map((entry) => entry.board)).toEqual([
      { kind: 'tally', label: null, wire: null },
      { kind: 'your_turn', label: 'Keep it going', wire: YOUR_TURN_BOARD },
    ]);
  });

  it('draws every board shape the Mentor lane draws, in every locale', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      for (const board of Object.values(boardFixtures(locale))) expect(boardWire(board), `${locale} ${board.kind}`).toBe(board);
    }
  });

  it('refuses to draw a board it cannot: unknown shape, no caption, a missing figure, a figure that is not a number', () => {
    expect(boardWire(null)).toBeNull();
    expect(boardWire({ kind: 'hologram', label: 'Space' })).toBeNull();
    expect(boardWire({ ...GOAL_BOARD, label: undefined })).toBeNull();
    expect(boardWire({ kind: 'goal_bar', saved: 5, target: 20, label: 'Old shape' })).toBeNull();
    expect(boardWire({ ...GOAL_BOARD, remaining: 'fifteen' })).toBeNull();
    expect(boardWire({ ...YOUR_TURN_BOARD, values: [15, null, 25] })).toBeNull();
    expect(boardWire({ kind: 'toString', label: 'x' })).toBeNull();
  });
});
