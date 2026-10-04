import { BufferGeometry, Material } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArXrSystem } from './arPilot';
import { startArSession } from './arSession';

/*
 * F4.9 safety: once the browser has opened the AR session the camera view is live, so a setup that fails afterwards must end the
 * session and release everything built so far. The WebGL renderer is the only fake here: jsdom has no GPU.
 */

const gpu = vi.hoisted(() => ({
  constructorFails: false,
  setSessionFails: false,
  renderers: [] as Array<{ dispose: () => void; setAnimationLoop: (loop: unknown) => void }>,
}));

vi.mock('three', async (original) => {
  const actual = await original<typeof import('three')>();
  class FakeRenderer {
    xr = {
      enabled: false,
      setReferenceSpaceType: vi.fn(),
      setSession: vi.fn(async () => { if (gpu.setSessionFails) throw new Error('the XR layer could not be created'); }),
      getReferenceSpace: vi.fn(() => null),
    };
    setAnimationLoop = vi.fn();
    dispose = vi.fn();
    render = vi.fn();
    constructor() {
      if (gpu.constructorFails) throw new Error('no WebGL context');
      gpu.renderers.push(this);
    }
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

const fakeSession = (over: Record<string, unknown> = {}) => {
  const listeners = new Map<string, () => void>();
  const hit = { cancel: vi.fn() };
  const session = {
    addEventListener: vi.fn((type: string, listener: () => void) => { listeners.set(type, listener); }),
    end: vi.fn(async () => { listeners.get('end')?.(); }),
    requestReferenceSpace: vi.fn(async () => ({})),
    requestHitTestSource: vi.fn(async () => hit),
    ...over,
  };
  const xr = { isSessionSupported: vi.fn(async () => true), requestSession: vi.fn(async () => session) } as unknown as ArXrSystem;
  return { session, xr, hit, fire: (type: string) => listeners.get(type)?.() };
};

const disposed = { geometry: 0, material: 0 };

beforeEach(() => {
  gpu.constructorFails = false;
  gpu.setSessionFails = false;
  gpu.renderers.length = 0;
  disposed.geometry = 0;
  disposed.material = 0;
  vi.spyOn(BufferGeometry.prototype, 'dispose').mockImplementation(() => { disposed.geometry += 1; });
  vi.spyOn(Material.prototype, 'dispose').mockImplementation(() => { disposed.material += 1; });
});
afterEach(() => vi.restoreAllMocks());

describe('startArSession', () => {
  it('ends the session and rejects when the renderer cannot be created', async () => {
    gpu.constructorFails = true;
    const { session, xr } = fakeSession();
    const onEnd = vi.fn();
    await expect(startArSession({ xr, object: 'litre-box', onEnd })).rejects.toThrow('no WebGL context');
    expect(session.end).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('ends the session and releases the renderer when the XR layer cannot be set', async () => {
    gpu.setSessionFails = true;
    const { session, xr } = fakeSession();
    const onEnd = vi.fn();
    await expect(startArSession({ xr, object: 'litre-box', onEnd })).rejects.toThrow('the XR layer could not be created');
    expect(session.end).toHaveBeenCalledTimes(1);
    expect(gpu.renderers).toHaveLength(1);
    expect(gpu.renderers[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(gpu.renderers[0]?.setAnimationLoop).toHaveBeenCalledWith(null);
    expect(disposed.geometry).toBe(2);
    expect(disposed.material).toBe(2);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('ends the session and releases everything when the reference space is refused', async () => {
    const { session, xr } = fakeSession({ requestReferenceSpace: vi.fn(async () => { throw new Error('no viewer space'); }) });
    const onEnd = vi.fn();
    await expect(startArSession({ xr, object: 'litre-box', onEnd })).rejects.toThrow('no viewer space');
    expect(session.end).toHaveBeenCalledTimes(1);
    expect(gpu.renderers[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(disposed.geometry).toBe(2);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('ends the session when the hit-test source is refused, and a late end event does not report an ended session', async () => {
    const { session, xr } = fakeSession({ requestHitTestSource: vi.fn(async () => { throw new Error('no hit test'); }) });
    const onEnd = vi.fn();
    await expect(startArSession({ xr, object: 'litre-box', onEnd })).rejects.toThrow('no hit test');
    expect(session.end).toHaveBeenCalledTimes(1);
    expect(gpu.renderers[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('still rejects when ending the failed session itself fails', async () => {
    gpu.setSessionFails = true;
    const { xr } = fakeSession({ end: vi.fn(async () => { throw new Error('already ended'); }) });
    await expect(startArSession({ xr, object: 'litre-box', onEnd: vi.fn() })).rejects.toThrow('the XR layer could not be created');
  });

  it('refuses to start when the browser ended the session during setup, and never starts the loop', async () => {
    const harness = fakeSession();
    harness.session.requestHitTestSource = vi.fn(async () => { harness.fire('end'); return harness.hit; });
    const onEnd = vi.fn();
    await expect(startArSession({ xr: harness.xr, object: 'litre-box', onEnd })).rejects.toThrow('ended while it was starting');
    expect(harness.hit.cancel).toHaveBeenCalledTimes(1);
    expect(gpu.renderers[0]?.dispose).toHaveBeenCalledTimes(1);
    const loops = vi.mocked(gpu.renderers[0]?.setAnimationLoop as (loop: unknown) => void).mock.calls.map(([loop]) => loop);
    expect(loops.every((loop) => loop === null)).toBe(true);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('keeps the session open on success and releases it once, when the browser ends it', async () => {
    const { session, xr, hit, fire } = fakeSession();
    const onEnd = vi.fn();
    const handle = await startArSession({ xr, object: 'litre-box', onEnd });
    expect(session.end).not.toHaveBeenCalled();
    expect(typeof vi.mocked(gpu.renderers[0]?.setAnimationLoop as (loop: unknown) => void).mock.calls.at(-1)?.[0]).toBe('function');
    fire('end');
    fire('end');
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(hit.cancel).toHaveBeenCalledTimes(1);
    expect(gpu.renderers[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(disposed.geometry).toBe(2);
    handle.end();
    await Promise.resolve();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('ends the session from the handle and reports the end once', async () => {
    const { session, xr } = fakeSession();
    const onEnd = vi.fn();
    const handle = await startArSession({ xr, object: 'litre-box', onEnd });
    handle.end();
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
    expect(session.end).toHaveBeenCalledTimes(1);
  });
});
