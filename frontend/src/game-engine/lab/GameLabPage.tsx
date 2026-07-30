// /dev/game-lab — the Game Engine QA surface (GAME_ENGINE.md §7 slices, §10 player).
// Dev-gated in App.tsx; never reaches a production bundle.
//
// Twin of /dev/lesson-lab, with the four affordances the determinism contract (§5)
// needs and that ONLY a lab can give, because a nondeterminism bug is otherwise a
// mystery — the server rejects a reward and nobody can reproduce the run:
//
//   SEED         every launch states the seed it used, and the seed is overridable,
//                so "it only breaks on this run" becomes a repeatable experiment.
//   TICK STEP    a manual GameLoopScheduler (the kernel's injectable seam) advances
//                the simulation one whole tick at a time instead of at rAF speed, so
//                the tick a state goes wrong on can actually be looked at.
//   SNAPSHOT     the live SimSnapshot the HUD reads, printed raw — the mechanic's own
//                View is a renderer and can hide a wrong score behind a right-looking
//                board.
//   LOG EXPORT   the completed input log as JSON, copyable, so the exact run can be
//                replayed through core/replay.ts here, in a test, or on the server.
//
// It also doubles as a build-progress view: every MECHANIC_IDS entry whose
// MECHANIC_LOADERS row is still null is listed, so "which mechanics exist" is read off
// the registry rather than remembered.
//
// Everything plays through the REAL GamePlayer with the REAL slice. A lab that
// re-implemented the player would verify the lab.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Card, Icon, ThemeToggle } from '@/components/ui'
import type { GameLoopScheduler } from '@/game-engine/core/kernel'
import { MECHANIC_IDS, TICK_MS } from '@/game-engine/core/types'
import type {
  GameDocument,
  MechanicId,
  MechanicSlice,
  MechanicViewProps,
  SimSnapshot,
} from '@/game-engine/core/types'
import GamePlayer from '@/game-engine/player/GamePlayer'
import type { GameRunSubmission } from '@/game-engine/player/GamePlayer'
import { MECHANIC_LOADERS, MECHANIC_META, loadMechanic } from '@/game-engine/registry'
import { cn } from '@/lib/utils'

// ---- Seeds -------------------------------------------------------------------

/** FNV-1a over the slug. A fixture therefore has the SAME default seed on every
 *  visit: an unreproducible default would defeat the point of showing the seed. */
function seedFromSlug(slug: string): number {
  let hash = 2166136261
  for (const char of slug) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** `null` = no override, use the fixture's own derived seed. */
function parseSeedOverride(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '' || !/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isSafeInteger(value) ? value : null
}

// ---- The manual scheduler (tick stepping) ------------------------------------

interface ManualScheduler extends GameLoopScheduler {
  /** Dispatches up to `ticks` frames, each carrying exactly TICK_MS of virtual time.
   *  Returns how many frames actually ran — zero once the loop has stopped or paused,
   *  because a halted loop schedules no frame to dispatch. */
  advance(ticks: number): number
}

/**
 * A GameLoopScheduler whose clock only moves when this lab moves it. `now()` never
 * reads the wall clock, so a breakpoint or a slow render cannot inject extra ticks:
 * one press is one tick, always.
 */
function createManualScheduler(): ManualScheduler {
  let clock = 0
  let nextHandle = 1
  const frames = new Map<number, () => void>()

  return {
    now: () => clock,
    request: (callback) => {
      const handle = nextHandle
      nextHandle += 1
      frames.set(handle, callback)
      return handle
    },
    cancel: (handle) => {
      frames.delete(handle)
    },
    advance: (ticks) => {
      let dispatched = 0
      for (let i = 0; i < ticks; i += 1) {
        if (frames.size === 0) break
        clock += TICK_MS
        const due = Array.from(frames.values())
        frames.clear()
        for (const callback of due) callback()
        dispatched += 1
      }
      return dispatched
    },
  }
}

// ---- The snapshot probe -------------------------------------------------------

interface ProbeSignal {
  snapshot: SimSnapshot
  paused: boolean
}

/**
 * Wraps a mechanic's View so the lab can read the live snapshot without the player
 * having to expose it. The View already receives exactly what the debug readout wants,
 * and a pass-through wrapper keeps the played code path identical to production.
 */
function createProbeView(
  View: ComponentType<MechanicViewProps>,
  report: (signal: ProbeSignal) => void,
): ComponentType<MechanicViewProps> {
  return function LabProbeView(props: MechanicViewProps) {
    const { snapshot, paused } = props
    useEffect(() => {
      report({ snapshot, paused })
    }, [snapshot, paused])
    return <View {...props} />
  }
}

// ---- Clipboard ----------------------------------------------------------------

type CopyState = 'idle' | 'ok' | 'failed'

/** The Clipboard API needs a secure context, which a plain `http://localhost` preview
 *  may not be. The console fallback keeps the log recoverable either way. */
async function copyJson(json: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
    try {
      await navigator.clipboard.writeText(json)
      return true
    } catch {
      // Falls through to the console.
    }
  }
  console.info('[game-lab] input log', json)
  return false
}

// ---- One run ------------------------------------------------------------------

interface ActiveRun {
  mechanic: MechanicId
  slice: MechanicSlice
  document: GameDocument
  seed: number
  /** Captured at launch: swapping schedulers mid-run would restart the simulation. */
  stepMode: boolean
}

const STEP_SIZES = [1, 10, 100] as const

interface GameLabRunProps {
  run: ActiveRun
  onExit: () => void
  onReplay: () => void
}

function GameLabRun({ run, onExit, onReplay }: GameLabRunProps) {
  const { t } = useTranslation()
  const [probe, setProbe] = useState<ProbeSignal | null>(null)
  const [submission, setSubmission] = useState<GameRunSubmission | null>(null)
  const [steps, setSteps] = useState(0)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  // Collapsed by default on a narrow viewport: the panel floats over the stage, and at
  // 375px it covered the pause overlay's own buttons — which broke the mobile QA pass
  // (§1.11) that this lab exists to serve. Expanded stays the default on desktop.
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  )

  const report = useCallback((signal: ProbeSignal) => setProbe(signal), [])

  // MUST be referentially stable for the whole run — useGameLoop tears the loop down
  // and starts a FRESH run when the slice, the scheduler or the document change.
  const scheduler = useMemo(() => (run.stepMode ? createManualScheduler() : null), [run.stepMode])
  const labSlice = useMemo<MechanicSlice>(
    () => ({ ...run.slice, View: createProbeView(run.slice.View, report) }),
    [run.slice, report],
  )

  const handleComplete = useCallback((completed: GameRunSubmission) => {
    setSubmission(completed)
  }, [])

  const advance = useCallback(
    (ticks: number) => {
      if (scheduler === null) return
      const dispatched = scheduler.advance(ticks)
      setSteps((previous) => previous + dispatched)
    },
    [scheduler],
  )

  const handleCopy = useCallback(() => {
    if (submission === null) return
    // Exactly what core/replay.ts needs to re-run this session anywhere.
    const payload = {
      mechanic: run.mechanic,
      slug: run.document.meta.slug,
      seed: submission.seed,
      duration_seconds: submission.duration_seconds,
      input_log: submission.input_log,
    }
    void copyJson(JSON.stringify(payload, null, 2)).then((ok) => {
      setCopyState(ok ? 'ok' : 'failed')
    })
  }, [run.document.meta.slug, run.mechanic, submission])

  const snapshot = probe?.snapshot ?? null
  const rows: [string, string][] = [
    ['mechanic', run.mechanic],
    ['slug', run.document.meta.slug],
    ['seed', String(run.seed)],
    ['mode', run.stepMode ? 'step' : 'live'],
    ['steps', String(steps)],
    ['score', snapshot === null ? '-' : String(snapshot.score)],
    ['lives', snapshot === null ? '-' : String(snapshot.lives)],
    ['round', snapshot === null ? '-' : String(snapshot.round)],
    ['finished', snapshot === null ? '-' : String(snapshot.finished)],
    ['paused', probe === null ? '-' : String(probe.paused)],
    ['events', submission === null ? '-' : String(submission.input_log.length)],
  ]

  return (
    <>
      <GamePlayer
        document={run.document}
        slice={labSlice}
        seed={run.seed}
        onComplete={handleComplete}
        onExit={onExit}
        onReplay={onReplay}
        {...(scheduler === null ? {} : { scheduler })}
      />

      {/* Above the player's own fixed z-50 shell, and full-width on mobile so the
          readout never sits under the HUD. */}
      <aside className="fixed bottom-3 left-3 right-3 z-[60] rounded-lg border border-outline/70 bg-surface/95 p-3 shadow-glass md:left-auto md:w-80">
        <div className="flex items-center justify-between gap-2">
          <p className="lf-label text-content">{t('games.lab.debug')}</p>
          <button
            type="button"
            onClick={() => setCollapsed((previous) => !previous)}
            aria-expanded={!collapsed}
            aria-label={t('games.lab.debug')}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-content-muted transition-colors hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Icon name={collapsed ? 'expand_less' : 'expand_more'} />
          </button>
        </div>

        {collapsed ? null : (
          <div className="mt-2">
            <div className="space-y-1">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <span className="lf-caption text-content-faint">{label}</span>
                  <span className="lf-caption truncate font-bold text-content">{value}</span>
                </div>
              ))}
            </div>

            {run.stepMode ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="lf-caption text-content-faint">{t('games.lab.step')}</span>
                {STEP_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => advance(size)}
                    className="lf-caption flex min-h-11 min-w-11 items-center justify-center rounded-full border border-outline px-3 font-bold text-content transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {`+${size}`}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={handleCopy}
                disabled={submission === null}
                className="px-4 py-2"
              >
                <Icon name="content_copy" className="text-[18px]" />
                {submission === null ? t('games.lab.awaitingLog') : t('games.lab.copyLog')}
              </Button>
              <Button variant="secondary" onClick={onReplay} className="px-4 py-2">
                <Icon name="restart_alt" className="text-[18px]" />
                {t('games.lab.restart')}
              </Button>
            </div>

            {copyState === 'ok' ? (
              <p className="lf-caption mt-2 text-success-strong">{t('games.lab.copied')}</p>
            ) : null}
            {copyState === 'failed' ? (
              <p className="lf-caption mt-2 text-content-muted">{t('games.lab.copyFailed')}</p>
            ) : null}
          </div>
        )}
      </aside>
    </>
  )
}

// ---- The lab ------------------------------------------------------------------

interface LoadedMechanic {
  mechanic: MechanicId
  slice: MechanicSlice
}

export function GameLabPage() {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState<LoadedMechanic[] | null>(null)
  const [seedText, setSeedText] = useState('')
  const [stepMode, setStepMode] = useState(false)
  const [active, setActive] = useState<ActiveRun | null>(null)
  const [runId, setRunId] = useState(0)

  // The hub loads NOTHING eagerly (registry.ts); the lab is the one surface that
  // wants every implemented mechanic at once, so it asks for all of them by hand.
  useEffect(() => {
    let cancelled = false
    const implemented = MECHANIC_IDS.filter((id) => MECHANIC_LOADERS[id] !== null)
    void Promise.all(
      implemented.map(async (mechanic): Promise<LoadedMechanic | null> => {
        const slice = await loadMechanic(mechanic).catch(() => null)
        return slice === null ? null : { mechanic, slice }
      }),
    ).then((entries) => {
      if (cancelled) return
      setLoaded(entries.filter((entry): entry is LoadedMechanic => entry !== null))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const pending = useMemo(() => MECHANIC_IDS.filter((id) => MECHANIC_LOADERS[id] === null), [])
  const seedOverride = parseSeedOverride(seedText)
  const fixtureCount = (loaded ?? []).reduce((total, entry) => total + entry.slice.fixtures.length, 0)

  const launch = useCallback(
    (mechanic: MechanicId, slice: MechanicSlice, document: GameDocument, seed: number) => {
      setRunId((previous) => previous + 1)
      setActive({ mechanic, slice, document, seed, stepMode })
    },
    [stepMode],
  )

  if (active !== null) {
    return (
      <GameLabRun
        key={runId}
        run={active}
        onExit={() => setActive(null)}
        onReplay={() => setRunId((previous) => previous + 1)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-container px-5 py-10 md:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="lf-display-lg text-content">{t('games.lab.title')}</h1>
            <p className="lf-body text-content-muted">
              {t('games.lab.subtitle', {
                fixtures: fixtureCount,
                ready: (loaded ?? []).length,
                total: MECHANIC_IDS.length,
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Standalone route (no app shell) — the lab applies the theme itself. */}
            <ThemeToggle />
            <label className="flex items-center gap-2">
              <span className="lf-caption text-content-faint">{t('games.lab.seed')}</span>
              <input
                type="text"
                inputMode="numeric"
                value={seedText}
                onChange={(event) => setSeedText(event.target.value)}
                placeholder={t('games.lab.seedAuto')}
                className="lf-caption h-11 w-36 rounded-full border-2 border-outline/70 bg-surface px-4 text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              />
            </label>
            <Button
              variant="secondary"
              onClick={() => setSeedText(String(Math.floor(Math.random() * 4294967296)))}
            >
              <Icon name="casino" className="text-[18px]" />
              {t('games.lab.newSeed')}
            </Button>
            <button
              type="button"
              onClick={() => setStepMode((previous) => !previous)}
              aria-pressed={stepMode}
              className={cn(
                'lf-label flex min-h-11 items-center gap-2 rounded-full border-2 bg-surface px-4 text-content transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                stepMode ? 'border-primary text-primary' : 'border-outline/70 hover:border-primary/60',
              )}
            >
              <Icon name="skip_next" />
              {t('games.lab.stepMode')}
            </button>
          </div>
        </div>

        {loaded === null ? <p className="lf-body text-content-muted">{t('games.lab.loading')}</p> : null}

        {(loaded ?? []).map(({ mechanic, slice }) => {
          const meta = MECHANIC_META[mechanic]
          return (
            <section key={mechanic} className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <Icon name={meta.icon} className="text-[24px] text-accent" />
                <h2 className="lf-headline text-content">{t(meta.titleKey)}</h2>
                <Badge>{mechanic}</Badge>
                <Badge>{slice.fixtures.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {slice.fixtures.map((fixture) => {
                  const seed = seedOverride ?? seedFromSlug(fixture.meta.slug)
                  return (
                    <Card key={fixture.meta.slug}>
                      <button
                        type="button"
                        onClick={() => launch(mechanic, slice, fixture, seed)}
                        className="flex w-full items-start justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <div className="min-w-0">
                          <p className="lf-title text-content">{fixture.meta.title}</p>
                          <p className="lf-caption truncate text-content-muted">
                            {fixture.meta.slug}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge>{`T${fixture.meta.tier}`}</Badge>
                            <Badge>{fixture.scoring.mode}</Badge>
                            <Badge>{`XP ${fixture.scoring.xp_max}`}</Badge>
                            <Badge>{`pass ${fixture.scoring.pass_score}`}</Badge>
                            <Badge>{`items ${fixture.content.items.length}`}</Badge>
                            <Badge>{`seed ${seed}`}</Badge>
                          </div>
                        </div>
                        <Icon name="play_circle" className="shrink-0 text-[28px] text-accent" />
                      </button>
                    </Card>
                  )
                })}
              </div>
            </section>
          )
        })}

        {pending.length > 0 ? (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="lf-headline text-content-muted">{t('games.lab.pending')}</h2>
              <Badge>{pending.length}</Badge>
            </div>
            <p className="lf-caption mb-4 text-content-faint">{t('games.lab.pendingHint')}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pending.map((mechanic) => {
                const meta = MECHANIC_META[mechanic]
                return (
                  <Card key={mechanic} className="opacity-60">
                    <div className="flex items-center gap-3">
                      <Icon name={meta.icon} className="text-[24px] text-content-faint" />
                      <div className="min-w-0">
                        <p className="lf-title text-content-muted">{t(meta.titleKey)}</p>
                        <p className="lf-caption truncate text-content-faint">{mechanic}</p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export default GameLabPage
