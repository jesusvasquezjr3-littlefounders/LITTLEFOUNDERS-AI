import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * GAP-FIX-R2 (Appendix C 1.2 Parent Time-to-Value, B.10): Core writes
 * parent_signup_completed and parent_first_value once per verified parent,
 * through insertLearningEvents (which applies the consent gate every event
 * has), and reads parent_time_to_value for the C.24 dashboard. The SQL is
 * proven on PostgreSQL by database/scripts/verify-mentor-quality-audits-postgres.py.
 */

const insertLearningEvents = vi.fn<(rows: unknown[]) => Promise<number | null>>(async () => 1);
const getRolesForGate = vi.fn<(id: string) => Promise<string[] | null>>(async () => ['parent']);

vi.mock('../services/insights.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../services/insights.js')>();
  return { ...real, insertLearningEvents: (rows: unknown[]) => insertLearningEvents(rows), getRolesForGate: (id: string) => getRolesForGate(id) };
});

const { parentJourneyEventId, readParentTimeToValue, recordParentJourneyEvent, resetParentJourneyCache } = await import('../services/parentTimeToValue.js');
const { RECORDABLE_EVENTS, SERVER_ONLY_EVENTS } = await import('../services/insights.js');

const PARENT = '66666666-6666-4666-8666-666666666666';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => { resetParentJourneyCache(); insertLearningEvents.mockClear(); getRolesForGate.mockClear(); });
afterEach(() => vi.unstubAllGlobals());

describe('parent journey events', () => {
  it('are recordable and server-only (the client ingest drops a forged one)', () => {
    for (const event of ['parent_signup_completed', 'parent_first_value']) {
      expect(RECORDABLE_EVENTS as readonly string[]).toContain(event);
      expect(SERVER_ONLY_EVENTS.has(event)).toBe(true);
    }
  });

  it('writes one event per account with a deterministic key, through the consent-gated insert', async () => {
    recordParentJourneyEvent(PARENT, 'parent_first_value');
    await flush(); await flush();
    expect(insertLearningEvents).toHaveBeenCalledTimes(1);
    expect(insertLearningEvents.mock.calls[0]![0]).toEqual([{
      user_id: PARENT, role: 'parent', event: 'parent_first_value', route_class: 'family', client_event_id: parentJourneyEventId('parent_first_value', PARENT),
    }]);
    expect(parentJourneyEventId('parent_first_value', PARENT)).toBe(parentJourneyEventId('parent_first_value', PARENT));
    expect(parentJourneyEventId('parent_first_value', PARENT)).not.toBe(parentJourneyEventId('parent_signup_completed', PARENT));
    // A second view in this process does not even ask again.
    recordParentJourneyEvent(PARENT, 'parent_first_value');
    await flush(); await flush();
    expect(insertLearningEvents).toHaveBeenCalledTimes(1);
  });

  it('records nothing for an account that is not a verified parent, and retries after a failed write', async () => {
    getRolesForGate.mockResolvedValueOnce(['universal']);
    recordParentJourneyEvent(PARENT, 'parent_signup_completed');
    await flush(); await flush();
    expect(insertLearningEvents).not.toHaveBeenCalled();
    insertLearningEvents.mockResolvedValueOnce(null);
    recordParentJourneyEvent(PARENT, 'parent_signup_completed');
    await flush(); await flush();
    recordParentJourneyEvent(PARENT, 'parent_signup_completed');
    await flush(); await flush();
    expect(insertLearningEvents).toHaveBeenCalledTimes(2);
  });

  it('never throws into the request when the gate read fails', async () => {
    getRolesForGate.mockRejectedValueOnce(new Error('down'));
    expect(() => recordParentJourneyEvent(PARENT, 'parent_first_value')).not.toThrow();
    await flush(); await flush();
    expect(insertLearningEvents).not.toHaveBeenCalled();
  });
});

describe('readParentTimeToValue', () => {
  it('parses the RPC row, and a failed or malformed read is null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ signups: '30', reached: 24, median_seconds: '142.5', p75_seconds: null, within_target: 17 }]), { status: 200 })));
    expect(await readParentTimeToValue(new Date('2026-09-01'), new Date('2026-09-28'))).toEqual({ signups: 30, reached: 24, medianSeconds: 142.5, p75Seconds: null, withinTarget: 17 });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
    expect(await readParentTimeToValue(new Date('2026-09-01'), new Date('2026-09-28'))).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    expect(await readParentTimeToValue(new Date('2026-09-01'), new Date('2026-09-28'))).toBeNull();
  });
});
