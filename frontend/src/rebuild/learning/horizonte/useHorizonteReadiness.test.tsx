import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { missingHorizontePacks } from './contract';
import { HORIZONTE_FIXTURES } from './fixtures';
import { horizonteFixtureDocument } from './previewDocument';
import { useHorizonteReadiness } from './useHorizonteReadiness';

const down = vi.hoisted(() => ({ alg1: true }));
vi.mock('./alg1/index', async (importOriginal) => {
  if (down.alg1) throw new Error('chunk failed');
  return importOriginal();
});

const doc = (pack: string) => horizonteFixtureDocument(pack, HORIZONTE_FIXTURES[pack]![0]!.id, 'en-US');

describe('useHorizonteReadiness', () => {
  it('is ready at once for a document that names no Horizonte type', () => {
    const { result } = renderHook(() => useHorizonteReadiness({ segments: [{ type: 'money.allocation.v2' }] }));
    expect(result.current).toBe('ready');
    expect(renderHook(() => useHorizonteReadiness(null)).result.current).toBe('ready');
  });

  it('waits for the pack a document names, then reports ready', async () => {
    const raw = doc('golden');
    const { result } = renderHook(() => useHorizonteReadiness(raw));
    expect(result.current).toBe('loading');
    await waitFor(() => expect(result.current).toBe('ready'));
    expect(missingHorizontePacks(raw)).toEqual([]);
  });

  it('reports failed when the pack does not download, and tries again for the next reader', async () => {
    const raw = doc('alg1');
    const first = renderHook(() => useHorizonteReadiness(raw));
    await waitFor(() => expect(first.result.current).toBe('failed'));
    expect(missingHorizontePacks(raw)).toEqual(['alg1']);

    down.alg1 = false;
    const second = renderHook(() => useHorizonteReadiness(raw));
    await waitFor(() => expect(second.result.current).toBe('ready'));
    expect(missingHorizontePacks(raw)).toEqual([]);
  });
});
