import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CHARACTER_IDS, type CharacterId } from '@/components/characters/control/types';
import { CharacterStage } from '../CharacterStage';
import { POSES, distinctPoseCount, posesByCategory, type Pose, type PoseCategory } from '../poseLibrary';
import type { SceneStats } from '../SceneCanvas';
// Development lab: it renders with the legacy global sheet, which the product entry no longer loads.
import '@/index.css';

/*
 * THE POSE LAB — every pose, on every character, looked at.
 *
 * This exists because of a specific precedent in this codebase: an
 * armature-space retarget was built, verified numerically correct on the
 * authoring rig at 2e-6, and was still visibly wrong on Rho. Numbers agreed and
 * the screen did not. A pose library reviewed by reading a table would repeat
 * that, at fifty-seven times the scale.
 *
 * So the lab renders. It is DEV-ONLY (`import.meta.env.DEV` in App.tsx) and
 * carries no i18n, because the audience is whoever is authoring poses.
 *
 * ONE CANVAS AT A TIME, ON PURPOSE. Fifty-seven live WebGL contexts is not a
 * review surface, it is a way to crash a laptop - browsers cap contexts around
 * sixteen and silently drop the oldest. The lab shows one pose large and steps
 * through them, which is also how a pose is actually judged: by watching it
 * play, not by seeing a wall of thumbnails frozen mid-gesture.
 */

const CATEGORY_ORDER: PoseCategory[] = [
  'greeting',
  'teaching',
  'feedback',
  'celebration',
  'thinking',
  'transition',
  'ambient',
  'marketing',
];

/*
 * THE LAB IS DEEP-LINKABLE, and that is not a convenience.
 *
 * A pose is reviewed by looking at it, which means a review is a conversation
 * about a specific pose on a specific character — "greet.bow reads as a stumble
 * on Liruf". Without a URL for that, the reviewer has to describe a click path.
 * It is also what lets the contact-sheet capture address every combination
 * without driving the UI, so the sheets in a review are of the same surface a
 * human opens rather than of a second one built to be photographed.
 */
function readParams(params: URLSearchParams): { character: CharacterId; poseId: string } {
  const character = CHARACTER_IDS.find((id) => id === params.get('character')) ?? 'zara';
  const poseId = POSES.find((p) => p.id === params.get('pose'))?.id ?? POSES[0]!.id;
  return { character, poseId };
}

export function PoseLabPage() {
  const [params, setParams] = useSearchParams();
  // Read ONCE, through the lazy initialiser: the URL seeds the lab, and after
  // that the lab owns the state and writes back to the URL. Reading it on every
  // render would fight the `setParams` below for control of the same value.
  const [character, setCharacter] = useState<CharacterId>(() => readParams(params).character);
  const [poseId, setPoseId] = useState<string>(() => readParams(params).poseId);
  const [replay, setReplay] = useState(0);
  const [stats, setStats] = useState<SceneStats | null>(null);

  // The URL trails the state rather than driving it: `replace` keeps fifty-seven
  // steps through the catalog from burying the page you arrived from.
  useEffect(() => {
    setParams({ character, pose: poseId }, { replace: true });
  }, [character, poseId, setParams]);

  const grouped = useMemo(() => posesByCategory(), []);
  const pose = useMemo(() => POSES.find((p) => p.id === poseId) ?? POSES[0]!, [poseId]);

  // Stepping through a category in order is how you notice that two poses read
  // identically — the most common defect in a library this size.
  function step(delta: number) {
    const i = POSES.findIndex((p) => p.id === pose.id);
    const next = POSES[(i + delta + POSES.length) % POSES.length]!;
    setPoseId(next.id);
    setReplay((r) => r + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-5 px-4 py-6 md:px-6">
      <header>
        <h1 className="lf-display-lg text-content">Pose lab</h1>
        <p className="lf-body text-content-muted">
          {POSES.length} poses · {distinctPoseCount()} distinct renders · {CHARACTER_IDS.length} characters ·
          every entry playable by every one of them
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {CHARACTER_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setCharacter(id);
              setReplay((r) => r + 1);
            }}
            className={`lf-label min-h-11 rounded-full px-4 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              character === id ? 'bg-primary text-on-accent' : 'bg-surface-sunken text-content hover:bg-surface'
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <CharacterStage
            key={`${character}-${pose.id}-${replay}`}
            id={character}
            emotion={pose.emotion}
            action={pose.action}
            actionKey={replay}
            rotation={pose.rotation ?? 0}
            fill={0.72}
            className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-surface-sunken sm:aspect-square"
            onStats={setStats}
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => step(-1)} className="lf-label min-h-11 rounded-full bg-surface-sunken px-4 text-content hover:bg-surface">
              ← prev
            </button>
            <button type="button" onClick={() => setReplay((r) => r + 1)} className="lf-label min-h-11 rounded-full bg-primary px-4 text-on-accent">
              replay
            </button>
            <button type="button" onClick={() => step(1)} className="lf-label min-h-11 rounded-full bg-surface-sunken px-4 text-content hover:bg-surface">
              next →
            </button>
            {/* The budget is code (`budget.ts`); this is the number a reviewer
                actually needs while judging whether a pose is affordable. */}
            {stats && (
              <span data-scene-stats className="lf-caption text-content-muted">
                {stats.triangles.toLocaleString()} tris · {stats.drawCalls} draw call{stats.drawCalls === 1 ? '' : 's'} · {Math.round(stats.fps)} fps · {stats.tier}
              </span>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-outline/60 bg-surface p-4">
            <p className="lf-label text-content">{pose.id}</p>
            <p className="lf-body mt-1 text-content-muted">{pose.use}</p>
            <p className="lf-caption mt-2 text-content-faint">
              {pose.emotion} · {pose.action}
              {pose.loop ? ' · loops' : ''}
              {pose.rotation ? ` · rotated ${pose.rotation.toFixed(2)} rad` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {CATEGORY_ORDER.map((category) => {
            const poses = grouped.get(category) ?? [];
            return (
              <section key={category}>
                <h2 className="lf-label text-content-muted">
                  {category} · {poses.length}
                </h2>
                <ul className="mt-2 flex flex-col gap-1">
                  {poses.map((p: Pose) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPoseId(p.id);
                          setReplay((r) => r + 1);
                        }}
                        className={`lf-body w-full rounded-md px-3 py-2 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                          p.id === pose.id ? 'bg-primary-soft text-primary' : 'text-content hover:bg-surface-sunken'
                        }`}
                      >
                        {p.id}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PoseLabPage;
