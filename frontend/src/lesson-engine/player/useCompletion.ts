import { useCallback, useEffect, useRef, useState } from 'react'
import type { ServerCompletion } from './completion'

/** Keep a failed completion retryable without restarting or regrading the run. */
export function useCompletion() {
  const [server, setServer] = useState<ServerCompletion | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const busy = useRef(false)
  const mounted = useRef(true)
  const operation = useRef<(() => void | Promise<ServerCompletion | null>) | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const retry = useCallback(async () => {
    if (busy.current || !operation.current) return
    busy.current = true
    setStatus('saving')
    try {
      const result = await operation.current()
      if (!mounted.current) return
      if (result === null) setStatus('error')
      else {
        if (result) setServer(result)
        setStatus('saved')
      }
    } catch {
      if (mounted.current) setStatus('error')
    } finally {
      busy.current = false
    }
  }, [])
  const save = useCallback((callback: () => void | Promise<ServerCompletion | null>) => {
    operation.current = callback
    void retry()
  }, [retry])
  return { server, status, save, retry }
}
