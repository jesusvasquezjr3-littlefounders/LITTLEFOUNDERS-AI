import { KID_A, KID_B, T } from '../console/consoleFixtures';
import type { PhotoPort } from './tasksApi';

/*
 * Fixtures for the rebuilt Tasks and coin screens' tests (W2F.2): Core's real
 * wire shapes (backend/src/routes/tasks.ts toWireTask, toWireCatalogItem,
 * toWireRedemption; routes/banking.ts toWireAccount, toWireAllowanceRule).
 */

export { KID_A, KID_B, T };
export const TASK_OPEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const TASK_DONE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const TASK_APPROVED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const TASK_CANCELLED = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const REWARD = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export const REWARD_PAUSED = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

export const taskWire = (over: Record<string, unknown> = {}) => ({
  id: TASK_OPEN, assignedBy: '11111111-1111-4111-8111-111111111111', assignedTo: KID_A, title: 'Set the table', rewardCoins: 0, recurrence: 'once', dueAt: null,
  status: 'open', allocated: false, createdAt: T, hasEvidence: false, requiresEvidence: false, cancelReason: null, kind: 'contribution', completedOn: null,
  childNote: null, ...over,
});

export const TASKS = [
  taskWire(),
  taskWire({ id: TASK_DONE, title: 'Wash the car', rewardCoins: 20, kind: 'bonus', status: 'done', hasEvidence: true, requiresEvidence: true, recurrence: 'weekly',
    childNote: 'I did the wheels too', completedOn: '2026-09-20' }),
  taskWire({ id: TASK_APPROVED, title: 'Water the plants', rewardCoins: 10, kind: 'bonus', status: 'approved', allocated: false }),
  taskWire({ id: TASK_CANCELLED, assignedTo: KID_B, title: 'Fold towels', status: 'cancelled', cancelReason: 'We did it together instead' }),
];

export const rewardWire = (over: Record<string, unknown> = {}) => ({ id: REWARD, parentUserId: '11111111-1111-4111-8111-111111111111', title: 'Pick dinner', cost: 15,
  active: true, createdAt: T, ...over });
export const REWARDS = [rewardWire(), rewardWire({ id: REWARD_PAUSED, title: 'Late bedtime', cost: 40, active: false })];

export const requestWire = (over: Record<string, unknown> = {}) => ({ id: '99999999-9999-4999-8999-999999999999', catalogId: REWARD, kidUserId: KID_A,
  status: 'requested', createdAt: T, decidedAt: null, decidedBy: null, fulfilledAt: null, childReasonKind: 'saved_for_it', childNote: null, ...over });

export const accountWire = (over: Record<string, unknown> = {}) => ({ nickname: 'Rocket Fund', cardDesign: 'ocean', displayNumber: 'LF-1234-5678', frozen: false,
  frozenBy: null, frozenAt: null, openedAt: T, ...over });
export const allowanceWire = (over: Record<string, unknown> = {}) => ({ amount: 10, frequency: 'weekly', anchorDay: 5, active: true, nextRunAt: '2026-09-25T00:00:00.000Z', ...over });

/** A photo port that records uploads and hands out fake object URLs. */
export function fakePhotos(options: { upload?: 'ok' | string; load?: 'ok' | string; pick?: File | null } = {}): PhotoPort & { uploads: string[]; released: string[] } {
  const uploads: string[] = [];
  const released: string[] = [];
  return {
    uploads, released,
    async pick() { return options.pick === undefined ? new File(['x'], 'photo.png', { type: 'image/png' }) : options.pick; },
    async upload(taskId) { uploads.push(taskId); return options.upload && options.upload !== 'ok' ? { ok: false, code: options.upload } : { ok: true, data: true }; },
    async load(taskId) { return options.load && options.load !== 'ok' ? { ok: false, code: options.load } : { ok: true, data: `blob:photo-${taskId}` }; },
    release(url) { released.push(url); },
  };
}
