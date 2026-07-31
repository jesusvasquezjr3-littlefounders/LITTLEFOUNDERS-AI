// /dev/game-lab — the Game Engine QA surface (GAME_ENGINE.md §7 slices, §10 player).
// Dev-gated in App.tsx; never reaches a production bundle.
//
// Twin of /dev/lesson-lab. Two affordances the determinism contract (§5) needs and
// that ONLY a lab can give, because a nondeterminism bug is otherwise a mystery — the
// server rejects a reward and nobody can reproduce the run:
//
//   SEED         every launch states the seed it used, and the seed is overridable,
//                so "it only breaks on this run" becomes a repeatable experiment.
//   LOG EXPORT   the completed input log as JSON, copyable, so the exact run can be
//                replayed through core/replay.ts here, in a test, or on the server.
//
// It also doubles as a build-progress view: every MECHANIC_IDS entry whose
// MECHANIC_LOADERS row is still null is listed, so "which mechanics exist" is read off
// the registry rather than remembered.
//
// Everything plays through the REAL GamePlayer with the REAL slice. A lab that
// re-implemented the player would verify the lab.
//
// ---- WHY TICK-STEP AND A LIVE SNAPSHOT READOUT ARE GONE ----------------------------
// The kernel-era version of this file drove the mechanic's View through a manual
// GameLoopScheduler (`core/kernel.ts`) and read its live state off `MechanicSlice.View`
// props. The Phaser rewrite (commit 4680a61 onward) replaced that entire path:
// `GameStage` (in `player/GamePlayer.tsx`) mounts `PhaserGameBox`, which loads a scene
// straight from `phaser/sceneRegistry.ts` by `document.meta.mechanic` — the `slice`
// prop `GamePlayer` still accepts is used ONLY for the null → "unsupported" card, and
// the `scheduler` prop it still accepts is not read by `GameStage` at all. Neither
// ever reaches the running simulation any more, so the tick-step buttons and the live
// score/lives/round/paused readout this lab used to render were dead controls that
// LOOKED wired and were not (the confirmed audit finding this file now fixes).
//
// `GamePlayer`'s public contract exposes no live per-tick signal to its caller — only
// `onComplete(run: GameRunSubmission)` once a run ends, carrying `seed`/`input_log`/
// `duration_seconds` and deliberately no score (§ the client never reports a score).
// This lab owns none of `player/GamePlayer.tsx`, `player/PhaserGameBox.tsx`,
// `phaser/scene.ts` or `phaser/bridge.ts`, so it cannot restore a live readout by
// itself. What follows is the honest subset: real values where `GamePlayer` actually
// exposes one, an explicit "not available" everywhere it does not, and a disabled
// (not silently inert) Step mode control. The exact seam that would unblock this,
// for whoever owns those files next:
//
//   1. `GamePlayerProps.onSnapshot?: (snap: BridgeSnapshot) => void` — forwarded from
//      `GameStage`'s existing `handleSnapshot` in addition to its own `setSnapshot`,
//      so a caller (this lab) can read the live score/lives/round/finished/tick.
//   2. `GamePlayerProps.stepMode?: boolean`, threaded down to a new
//      `PhaserGameBoxProps.stepMode?: boolean`: when true, `BaseMechanicScene.update()`
//      must NOT call `this.bridge.update(delta)` on its own; the bridge only advances
//      when driven manually.
//   3. `PhaserGameBoxProps` needs a way to hand the caller a manual-advance handle —
//      e.g. `onSceneReady?: (controls: { advanceOneTick: () => void }) => void` fired
//      once `sceneRef.current` exists, mirroring the `togglePause` seam already there.
//      `advanceOneTick` would call `this.bridge.update(TICK_MS)` exactly once and run
//      the same post-update bookkeeping `update()` already does (snapshot diff,
//      `updateGameObjects`, completion edge) — the smallest change is probably
//      extracting that bookkeeping out of `update()` into a private method both call.
//
// Until that lands, `stepMode` here is a disabled, explained control rather than a
// button that quietly does nothing.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Card, Icon, ThemeToggle } from '@/components/ui'
import { MECHANIC_IDS } from '@/game-engine/core/types'
import type { GameDocument, MechanicId, MechanicSlice } from '@/game-engine/core/types'
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
}

/** A row in the debug readout. `unavailable` renders the value as an explicit
 *  "not available" instead of a value that merely never updates — a permanent-looking
 *  dash is indistinguishable from "hasn't happened yet" and is exactly the silent-lie
 *  failure mode this file exists to close. */
interface DebugRow {
  label: string
  value: string
  unavailable?: boolean
}

interface GameLabRunProps {
  run: ActiveRun
  onExit: () => void
  onReplay: () => void
}

function GameLabRun({ run, onExit, onReplay }: GameLabRunProps) {
  const { t } = useTranslation()
  const [submission, setSubmission] = useState<GameRunSubmission | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  // Collapsed by default on a narrow viewport: the panel floats over the stage, and at
  // 375px it covered the pause overlay's own buttons — which broke the mobile QA pass
  // (§1.11) that this lab exists to serve. Expanded stays the default on desktop.
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  )

  const handleComplete = useCallback((completed: GameRunSubmission) => {
    setSubmission(completed)
  }, [])

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

  // `finished` is real, derived from whether GamePlayer has reported completion — the
  // one live-ish signal its public contract actually exposes. Everything below it is
  // NOT available through that contract today; see the file-level comment for the
  // exact seam that would make it real instead of an honest placeholder.
  const finished = submission !== null
  const unavailable = t('games.lab.unavailable')

  const rows: DebugRow[] = [
    { label: 'mechanic', value: run.mechanic },
    { label: 'slug', value: run.document.meta.slug },
    { label: 'seed', value: String(run.seed) },
    { label: 'finished', value: String(finished) },
    { label: 'events', value: submission === null ? '-' : String(submission.input_log.length) },
    {
      label: 'duration_s',
      value: submission === null ? '-' : String(submission.duration_seconds),
    },
    { label: 'score', value: unavailable, unavailable: true },
    { label: 'lives', value: unavailable, unavailable: true },
    { label: 'round', value: unavailable, unavailable: true },
    { label: 'paused', value: unavailable, unavailable: true },
  ]

  return (
    <>
      <GamePlayer
        document={run.document}
        slice={run.slice}
        seed={run.seed}
        onComplete={handleComplete}
        onExit={onExit}
        onReplay={onReplay}
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
              {rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3">
                  <span className="lf-caption text-content-faint">{row.label}</span>
                  <span
                    className={cn(
                      'lf-caption truncate',
                      row.unavailable ? 'italic text-content-faint' : 'font-bold text-content',
                    )}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <p className="lf-caption mt-2 text-content-faint">{t('games.lab.telemetryNote')}</p>

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
      setActive({ mechanic, slice, document, seed })
    },
    [],
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
            {/* Disabled, not hidden: the affordance documents that step mode is a real,
                planned capability rather than pretending it doesn't exist — but it must
                never look pressable when pressing it does nothing (see the file-level
                comment for the exact seam this is waiting on). */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={t('games.lab.stepModeUnavailable')}
              className="lf-label flex min-h-11 cursor-not-allowed items-center gap-2 rounded-full border-2 border-outline/40 bg-surface px-4 text-content-faint opacity-60"
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
