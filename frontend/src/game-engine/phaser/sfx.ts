import { isGameAudioMuted } from '@/game-engine/core/audio'

let audioCtx: AudioContext | null = null

// The ONE chokepoint every Sfx.* entry point routes through (playTone/playNoise, and
// the two hand-rolled whoosh/powerUp calls below) — checked here rather than at each
// of the 12 call sites, so muting can never be forgotten by a future sound. Before this
// fix `Sfx.*` ran its own AudioContext straight to `ctx.destination` and never
// consulted the mute flag the pause overlay's icon claimed to control.
function getCtx(): AudioContext | null {
  if (isGameAudioMuted()) return null
  if (audioCtx && audioCtx.state !== 'closed') return audioCtx
  try {
    audioCtx = new (window.AudioContext || ((window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext))()
    return audioCtx
  } catch {
    return null
  }
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.15,
  rampDown: boolean = true,
): void {
  const ctx = getCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime)

  gain.gain.setValueAtTime(volume, ctx.currentTime)
  if (rampDown) {
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  }

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

function playNoise(duration: number, volume: number = 0.08): void {
  const ctx = getCtx()
  if (!ctx) return

  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2)
  }

  const source = ctx.createBufferSource()
  const gain = ctx.createGain()

  source.buffer = buffer
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  source.connect(gain)
  gain.connect(ctx.destination)
  source.start(ctx.currentTime)
}

export const Sfx = {
  click(): void {
    playTone(800, 0.06, 'sine', 0.1)
  },

  pop(): void {
    playTone(600, 0.1, 'sine', 0.12)
  },

  collect(): void {
    playTone(880, 0.12, 'sine', 0.1)
    setTimeout(() => playTone(1100, 0.1, 'sine', 0.08), 60)
  },

  correct(): void {
    playTone(523, 0.1, 'sine', 0.1)
    setTimeout(() => playTone(659, 0.1, 'sine', 0.1), 80)
    setTimeout(() => playTone(784, 0.15, 'sine', 0.1), 160)
  },

  wrong(): void {
    playTone(330, 0.15, 'square', 0.06)
    setTimeout(() => playTone(277, 0.2, 'square', 0.06), 100)
  },

  hit(): void {
    playNoise(0.08, 0.08)
    playTone(200, 0.06, 'triangle', 0.12)
  },

  heavyHit(): void {
    playNoise(0.12, 0.1)
    playTone(100, 0.1, 'triangle', 0.2)
  },

  explosion(): void {
    playNoise(0.3, 0.15)
    playTone(80, 0.2, 'sawtooth', 0.1)
  },

  combo(): void {
    playTone(1000, 0.08, 'sine', 0.08)
  },

  levelUp(): void {
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.15, 'sine', 0.1), i * 100)
    })
  },

  gameOver(): void {
    const notes = [440, 415, 392, 330]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.2, 'triangle', 0.1), i * 200)
    })
  },

  whoosh(): void {
    const ctx = getCtx()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.2)

    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.2)
  },

  powerUp(): void {
    const ctx = getCtx()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.4)

    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  },
}

export type SfxName = keyof typeof Sfx
