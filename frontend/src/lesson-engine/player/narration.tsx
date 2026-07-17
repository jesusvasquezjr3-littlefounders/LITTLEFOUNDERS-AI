// Narration playback — wires Echo's audio manifest (lesson_documents.audio,
// served by Core alongside the document) into the player. One shared
// HTMLAudioElement; unit ids follow Echo's extractor convention
// (`<segment_id>.prompt`, `<segment_id>.line.<n>`, `<segment_id>.explanation`).
// Exercise components reach it through context so e.g. story_dialogue can
// voice each line as the kid taps through — without the registry's prop
// surface growing an audio-specific field per family.

import { createContext, useContext, useEffect, useMemo, useRef } from 'react'

export interface AudioManifest {
  version?: number
  units?: Record<string, { url?: string; duration_ms?: number | null }>
}

interface NarrationApi {
  /** True when the manifest has a playable clip for this unit. */
  has: (unitId: string) => boolean
  /** Fire-and-forget playback (stops whatever was playing). Autoplay refusals are swallowed — the replay button is the fallback. */
  play: (unitId: string) => void
  stop: () => void
}

const noop: NarrationApi = { has: () => false, play: () => undefined, stop: () => undefined }

const NarrationContext = createContext<NarrationApi>(noop)

export function useNarration(): NarrationApi {
  return useContext(NarrationContext)
}

export function NarrationProvider({ manifest, children }: { manifest: AudioManifest | null | undefined; children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const api = useMemo<NarrationApi>(() => {
    const units = manifest?.units ?? {}
    return {
      has: (unitId) => typeof units[unitId]?.url === 'string' && units[unitId].url.length > 0,
      play: (unitId) => {
        const url = units[unitId]?.url
        if (!url) return
        if (!audioRef.current) audioRef.current = new Audio()
        const el = audioRef.current
        el.pause()
        el.src = url
        el.currentTime = 0
        // Browsers may reject play() without user activation; segment
        // transitions are click-driven so this usually succeeds — when it
        // doesn't, the visible replay button covers it.
        void el.play().catch(() => undefined)
      },
      stop: () => {
        audioRef.current?.pause()
      },
    }
  }, [manifest])

  // Never leak narration past unmount (exit mid-lesson).
  useEffect(
    () => () => {
      audioRef.current?.pause()
      audioRef.current = null
    },
    [],
  )

  return <NarrationContext.Provider value={api}>{children}</NarrationContext.Provider>
}

/**
 * Echo's deterministic unit-id convention (audiogen extractNarratables):
 * `<segment_id>.<field>` where field ∈ prompt | explanation | body |
 * line.<n> | idea.<n> | card.<n>.back | recap.
 */
export function narrationUnitId(segmentId: string, field: string): string {
  return `${segmentId}.${field}`
}
