import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCompletion } from './useCompletion'
import type { ServerCompletion } from './completion'

describe('completion persistence recovery', () => {
  it('retains the original operation for a retry after a rejected request', async () => {
    const response = { xp_delta: 20 } as ServerCompletion
    const persist = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response)
    const { result } = renderHook(useCompletion)
    act(() => result.current.save(persist))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.server).toBeNull()
    await act(() => result.current.retry())
    expect(result.current.status).toBe('saved')
    expect(result.current.server).toEqual(response)
    expect(persist).toHaveBeenCalledTimes(2)
  })

  it('treats a null response as unsaved and prevents concurrent retries', async () => {
    let finish!: (value: null) => void
    const persist = vi.fn(() => new Promise<null>(resolve => { finish = resolve }))
    const { result } = renderHook(useCompletion)
    act(() => result.current.save(persist))
    expect(result.current.status).toBe('saving')
    await act(() => result.current.retry())
    expect(persist).toHaveBeenCalledTimes(1)
    await act(async () => finish(null))
    expect(result.current.status).toBe('error')
  })

  it('does not install a response after leaving the player', async () => {
    let finish!: (value: ServerCompletion) => void
    const { result, unmount } = renderHook(useCompletion)
    act(() => result.current.save(() => new Promise(resolve => { finish = resolve })))
    unmount()
    await act(async () => finish({ xp_delta: 20 } as ServerCompletion))
    expect(result.current.server).toBeNull()
  })
})
