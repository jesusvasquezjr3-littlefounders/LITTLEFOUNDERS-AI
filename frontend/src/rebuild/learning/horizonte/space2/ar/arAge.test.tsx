import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../../LessonDocumentView';
import { horizonteFixtureDocument } from '../../previewDocument';
import { ArPilotContext, defaultArPilot, type ArPilotEnvironment, type ArStartInput, type ArXrSystem } from './arPilot';
import { arAgeFromScreen } from './arAge';

/*
 * F4.9 fix round: the AR gate reads the learner's real age. Core's age screen gives a band; the board turns it into the lowest
 * age the band allows, and anything unknown keeps the pilot closed. The flag stays off by default, so none of this runs in
 * a production build, and the camera is never touched here: the test's WebXR system only answers "supported".
 */

const mocks = vi.hoisted(() => ({
  auth: { session: { user: { id: 'learner-1' } } as unknown, getToken: vi.fn() },
  api: vi.fn(),
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/api', async (original) => ({ ...(await original<typeof import('@/lib/api')>()), api: mocks.api }));
vi.mock('@/tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'none', maxTextureSize: 0, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('@/tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const environment = (over: Partial<ArPilotEnvironment> = {}) => {
  const requestSession = vi.fn(async () => { throw new Error('the board must never open a session itself'); });
  const isSessionSupported = vi.fn(async () => true);
  const xr: ArXrSystem = { isSessionSupported, requestSession };
  const start = vi.fn(async (_input: ArStartInput) => ({ end: vi.fn() }));
  const env: ArPilotEnvironment = { flag: true, consent: { learner: true, guardian: true }, xr: () => xr, start, ...over };
  return { env, isSessionSupported, requestSession, start };
};
const showBoard = (env?: ArPilotEnvironment) => {
  const view = <LessonDocumentView raw={horizonteFixtureDocument('space2', 'object-on-the-table', 'en-US')} locale="en-US" ageBand="13-17" onBack={() => {}} onGradeAny={() => ({ verdict: 'review' as const })} />;
  render(env ? <ArPilotContext.Provider value={env}>{view}</ArPilotContext.Provider> : view);
};
const seeOnTable = () => screen.queryByRole('button', { name: 'See on table' });
const answer = (screening: Record<string, unknown> | null) => mocks.api.mockResolvedValue(screening ? { data: screening, error: null } : { data: null, error: { code: 'INTERNAL', message: 'down' } });

beforeEach(() => {
  mocks.auth.session = { user: { id: 'learner-1' } };
  mocks.auth.getToken.mockReset().mockResolvedValue('jwt');
  mocks.api.mockReset();
});
afterEach(() => cleanup());

describe('arAgeFromScreen', () => {
  it('reads an age only from a finished screen, and never above the band', () => {
    expect(arAgeFromScreen({ required: false, ageBand: 'adult' })).toBe(18);
    expect(arAgeFromScreen({ required: false, ageBand: '13_to_17' })).toBe(13);
  });

  it('reads no age when the learner is under 13, has not been screened, or the answer is odd', () => {
    expect(arAgeFromScreen({ required: false, ageBand: 'under_13' })).toBeNull();
    expect(arAgeFromScreen({ required: true, ageBand: null })).toBeNull();
    expect(arAgeFromScreen({ required: true, ageBand: 'adult' })).toBeNull();
    expect(arAgeFromScreen({ required: false, ageBand: null })).toBeNull();
    expect(arAgeFromScreen({ required: false, ageBand: 'adult ' })).toBeNull();
    expect(arAgeFromScreen({ ageBand: 'adult' })).toBeNull();
    for (const odd of [null, undefined, 'adult', 18, [], {}]) expect(arAgeFromScreen(odd)).toBeNull();
  });
});

describe('the AR gate with the learner real age', () => {
  it('asks Core for nothing when the pilot flag is off, or when no environment is supplied at all', async () => {
    expect(defaultArPilot.flag).toBe(false);
    expect(defaultArPilot.consent).toBeNull();
    expect(defaultArPilot.age).toBeUndefined();
    answer({ required: false, ageBand: 'adult' });
    showBoard();
    await screen.findByRole('group', { name: 'One litre box' });
    cleanup();
    const off = environment({ flag: false });
    showBoard(off.env);
    await screen.findByRole('group', { name: 'One litre box' });
    expect(mocks.api).not.toHaveBeenCalled();
    expect(mocks.auth.getToken).not.toHaveBeenCalled();
    expect(seeOnTable()).toBeNull();
    expect(off.isSessionSupported).not.toHaveBeenCalled();
  });

  it('opens for a verified adult once Core says adult and consent is recorded', async () => {
    answer({ required: false, ageBand: 'adult' });
    const { env, start, requestSession } = environment({ consent: { learner: true, guardian: false } });
    showBoard(env);
    expect(await screen.findByRole('button', { name: 'See on table' })).toBeTruthy();
    expect(mocks.api).toHaveBeenCalledWith('/auth/age-screen', { token: 'jwt' });
    expect(start).not.toHaveBeenCalled();
    expect(requestSession).not.toHaveBeenCalled();
  });

  it('keeps a 13 to 17 learner closed without a guardian consent, and never touches the camera', async () => {
    answer({ required: false, ageBand: '13_to_17' });
    const { env, isSessionSupported, start, requestSession } = environment({ consent: { learner: true, guardian: false } });
    showBoard(env);
    await screen.findByRole('group', { name: 'One litre box' });
    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(seeOnTable()).toBeNull();
    expect(isSessionSupported).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(requestSession).not.toHaveBeenCalled();
  });

  it('opens for a 13 to 17 learner only when a guardian consent is also recorded', async () => {
    answer({ required: false, ageBand: '13_to_17' });
    const { env } = environment({ consent: { learner: true, guardian: true } });
    showBoard(env);
    expect(await screen.findByRole('button', { name: 'See on table' })).toBeTruthy();
  });

  it('stays closed with no consent at all, even for an adult (the default until Core records consent)', async () => {
    answer({ required: false, ageBand: 'adult' });
    const { env, isSessionSupported } = environment({ consent: null });
    showBoard(env);
    await screen.findByRole('group', { name: 'One litre box' });
    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(seeOnTable()).toBeNull();
    expect(isSessionSupported).not.toHaveBeenCalled();
  });

  it('stays closed when the learner is under 13, not screened yet, or Core cannot answer', async () => {
    for (const screening of [{ required: false, ageBand: 'under_13' }, { required: true, ageBand: null }, null]) {
      answer(screening);
      const { env, isSessionSupported, start } = environment();
      showBoard(env);
      await screen.findByRole('group', { name: 'One litre box' });
      await waitFor(() => expect(mocks.api).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(seeOnTable()).toBeNull();
      expect(isSessionSupported).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      cleanup();
      mocks.api.mockReset();
    }
  });

  it('stays closed while Core has not answered yet, and with no signed-in learner or token', async () => {
    mocks.api.mockReturnValue(new Promise(() => {}));
    const waiting = environment();
    showBoard(waiting.env);
    await screen.findByRole('group', { name: 'One litre box' });
    expect(seeOnTable()).toBeNull();
    expect(waiting.isSessionSupported).not.toHaveBeenCalled();
    cleanup();

    mocks.api.mockReset();
    mocks.auth.session = null;
    const signedOut = environment();
    showBoard(signedOut.env);
    await screen.findByRole('group', { name: 'One litre box' });
    expect(mocks.api).not.toHaveBeenCalled();
    expect(seeOnTable()).toBeNull();
    cleanup();

    mocks.auth.session = { user: { id: 'learner-1' } };
    mocks.auth.getToken.mockResolvedValue(null);
    const noToken = environment();
    showBoard(noToken.env);
    await screen.findByRole('group', { name: 'One litre box' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.api).not.toHaveBeenCalled();
    expect(seeOnTable()).toBeNull();
  });

  it('never asks Core when the app supplies the age itself, and uses it as given', async () => {
    const supplied = environment({ age: 30, consent: { learner: true, guardian: false } });
    showBoard(supplied.env);
    expect(await screen.findByRole('button', { name: 'See on table' })).toBeTruthy();
    expect(mocks.api).not.toHaveBeenCalled();
    cleanup();

    const unknown = environment({ age: null, consent: { learner: true, guardian: true } });
    showBoard(unknown.env);
    await screen.findByRole('group', { name: 'One litre box' });
    expect(seeOnTable()).toBeNull();
    expect(unknown.isSessionSupported).not.toHaveBeenCalled();
    expect(mocks.api).not.toHaveBeenCalled();
  });
});
