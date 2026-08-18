import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useTranslation } from 'react-i18next';
import { SceneCanvas, type SceneStats } from '../SceneCanvas';
import { SceneLighting } from '../SceneLighting';
import { useSceneModel } from '../useSceneModel';
import { getDeviceProbe, QUALITY_SETTINGS, type QualitySettings } from '../quality';
import { readBudget, TUTOR_ASSET_BUDGET } from '../budget';
import { fitObject } from '../fitCamera';
import { TutorScene, type TutorFraming } from '../TutorScene';
import {
  CHARACTER_ACTIONS,
  CHARACTER_EMOTIONS,
  type CharacterAction,
  type CharacterEmotion,
  type CharacterId,
} from '@/components/characters/control/types';
import { VISEMES } from '../mouthAtlas';
import { useLipSync } from '../useLipSync';
import { CHARACTER_ASSETS, SCENE_ASSETS } from '../assets';
import { Vector3, type PerspectiveCamera } from 'three';

/** Every shipped asset, so the lab can inspect them without a file picker. */
const PRESETS = [
  ...Object.values(SCENE_ASSETS).map((a) => ({ id: a.id, url: a.url })),
  ...Object.values(CHARACTER_ASSETS).map((a) => ({ id: a.id, url: a.url })),
];

/*
 * DEV-only harness for the Tutor's 3D layer — the 3D counterpart to
 * /dev/lesson-lab. Its whole job is to make the asset budget (budget.ts)
 * MEASURABLE against a real artist export instead of asserted in a brief:
 * drop in a .glb and it reports triangles, draw calls, file size and the live
 * quality tier the adaptive governor settled on.
 *
 * It also runs without any model at all, on a placeholder scene, so the
 * renderer, tiering, theming and pause behaviour can be verified before the
 * first character exists.
 */

/** Imperative rather than declarative to avoid R3F v8 type augmentation for a dev-only control. */
function Controls({ target }: { target: Vector3 }) {
  const camera = useThree((s) => s.camera);
  const domElement = useThree((s) => s.gl.domElement);
  const controls = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const instance = new OrbitControls(camera, domElement);
    instance.enableDamping = true;
    controls.current = instance;
    return () => {
      instance.dispose();
      controls.current = null;
    };
  }, [camera, domElement]);

  useEffect(() => {
    controls.current?.target.copy(target);
  }, [target]);

  useFrame(() => controls.current?.update());
  return null;
}

/**
 * Stand-in geometry at the scale the spec asks for: a 1.2 m figure on a ground
 * plane. Deliberately trivial — if the placeholder does not hold 60fps, the
 * problem is the renderer setup, not the art.
 */
function PlaceholderScene({ settings }: { settings: QualitySettings }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={settings.shadows}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#c9d4e8" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow={settings.shadows}>
        <capsuleGeometry args={[0.28, 0.62, 6, 16]} />
        <meshStandardMaterial color="#f4a259" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.32, 0]} castShadow={settings.shadows}>
        <sphereGeometry args={[0.3, 24, 16]} />
        <meshStandardMaterial color="#ffd8a8" roughness={0.5} />
      </mesh>
    </group>
  );
}

function LoadedModel({ url, settings, onFit }: { url: string; settings: QualitySettings; onFit: (t: Vector3) => void }) {
  const { scene } = useSceneModel(url, settings);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  // Frame whatever was loaded, whatever units it is in. Without this the lab
  // shows an empty viewport for any asset that is not roughly 2 units tall.
  useEffect(() => {
    const fit = fitObject(scene, camera, size.width / size.height);
    camera.position.copy(fit.position);
    camera.near = Math.max(fit.radius / 100, 0.001);
    camera.far = fit.radius * 100;
    camera.updateProjectionMatrix();
    camera.lookAt(fit.target);
    onFit(fit.target);
  }, [scene, camera, size.width, size.height, onFit]);

  return <primitive object={scene} />;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'over' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-outline py-1.5">
      <span className="lf-caption text-content-muted">{label}</span>
      <span
        className={
          tone === 'over'
            ? 'lf-caption font-semibold tabular-nums text-error-strong'
            : tone === 'ok'
              ? 'lf-caption font-semibold tabular-nums text-success-strong'
              : 'lf-caption font-semibold tabular-nums text-content'
        }
      >
        {value}
      </span>
    </div>
  );
}

export default function SceneLabPage() {
  const { t, i18n } = useTranslation();
  const probe = useMemo(() => getDeviceProbe(), []);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [fileBytes, setFileBytes] = useState<number | undefined>(undefined);
  const [stats, setStats] = useState<SceneStats | null>(null);
  const [settings, setSettings] = useState<QualitySettings>(QUALITY_SETTINGS.medium);
  const [target, setTarget] = useState(() => new Vector3(0, 0.9, 0));
  const [composed, setComposed] = useState(true);
  const [action, setAction] = useState<CharacterAction>('idle');
  const [actionKey, setActionKey] = useState(0);
  /*
   * The composed scene shipped with a fixed cast of rho + liruf, which meant
   * the lab could not show two of the four characters at all — including the
   * only one with a mouth card. A harness whose job is verification has to be
   * able to put the thing being verified on screen.
   */
  const [lead, setLead] = useState<CharacterId>('rho');
  /*
   * Same reason the lead is switchable: the composed scene was pinned to
   * `diorama-a`, so the harness could not show the other island with anyone
   * standing on it — and whether a cast FITS an island is a question only the
   * composed view can answer. Dina alone covers 2.83 m of a 6.5 m island.
   */
  const [stage, setStage] = useState<keyof typeof SCENE_ASSETS>('diorama-a');
  const [viseme, setViseme] = useState(0);
  const [framing, setFraming] = useState<TutorFraming>('vignette');
  const [emotion, setEmotion] = useState<CharacterEmotion>('neutral');
  /*
   * A real <audio> element driving the mouth, so the TTS path is exercised end
   * to end here rather than asserted. `audiogen` will hand the product a URL;
   * this stands in for it with a clip that is already in the repo.
   */
  const speech = useRef<HTMLAudioElement | null>(null);
  const [speechEl, setSpeechEl] = useState<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const spokenViseme = useLipSync(speaking ? speechEl : null);
  const onFit = useCallback((next: Vector3) => setTarget(next.clone()), []);

  const nf = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language]);

  const onPick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileBytes(file.size);
    // Object URLs are revoked by the effect below when they are replaced.
    setModelUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  }, []);

  useEffect(() => () => { if (modelUrl) URL.revokeObjectURL(modelUrl); }, [modelUrl]);

  const readings = stats
    ? readBudget({
        triangles: stats.triangles,
        drawCalls: stats.drawCalls,
        fileBytes,
        // The composed scene is a live render; `inspect asset` measures one file.
        perFrame: composed,
      })
    : [];

  const unknown = t('tutor.lab.unknown');

  return (
    <div className="min-h-screen bg-base py-6 md:py-10">
      <div className="mx-auto max-w-container px-5 md:px-8">
        <header className="mb-6">
          <h1 className="lf-display-lg text-content">{t('tutor.lab.title')}</h1>
          <p className="lf-body text-content-muted">{t('tutor.lab.subtitle')}</p>
        </header>

        {/* Stand-in for a TTS response. Muted attribute deliberately absent:
            the analyser taps the element, so it has to actually play. */}
        <audio
          ref={(node) => {
            speech.current = node;
          }}
          src="/sounds/edu/lesson_complete.mp3"
          preload="auto"
          onEnded={() => setSpeaking(false)}
        />

        {/* Desktop uses the freed width for a viewport + inspector split; mobile stacks (§1.11). */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* min-w-0: the desktop template already says minmax(0,1fr), but at
              mobile this is a single-column grid whose item still defaults to
              min-width:auto — and the canvas inside it has an intrinsic size. */}
          <div className="min-w-0">
            {composed ? (
              <TutorScene
                className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-sunken lg:aspect-video"
                onStats={setStats}
                scene={stage}
                action={action}
                actionKey={actionKey}
                character={lead}
                companion={lead === 'liruf' ? 'rho' : 'liruf'}
                viseme={speaking ? spokenViseme : viseme}
                framing={framing}
                emotion={emotion}
              />
            ) : (
            <SceneCanvas className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-sunken lg:aspect-video" onStats={setStats} onSettings={setSettings}>
              <SceneLighting settings={settings} />
              <Controls target={target} />
              <Suspense fallback={null}>
                {modelUrl ? (
                  <LoadedModel key={modelUrl} url={modelUrl} settings={settings} onFit={onFit} />
                ) : (
                  <PlaceholderScene settings={settings} />
                )}
              </Suspense>
            </SceneCanvas>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {composed
                ? CHARACTER_ACTIONS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      data-action={name}
                      onClick={() => {
                        setAction(name);
                        setActionKey((k) => k + 1);
                      }}
                      className={
                        name === action
                          ? 'lf-caption rounded-sm border border-primary bg-primary-soft px-3 py-1.5 font-semibold text-content'
                          : 'lf-caption rounded-sm border border-outline px-3 py-1.5 font-semibold text-content'
                      }
                    >
                      {name}
                    </button>
                  ))
                : null}
              <button
                type="button"
                onClick={() => setComposed((v) => !v)}
                className="lf-caption rounded-sm border border-outline px-3 py-1.5 font-semibold text-content"
              >
                {composed ? 'inspect asset' : 'composed scene'}
              </button>
              {composed ? (
                <button
                  type="button"
                  data-speaking={speaking ? 'yes' : 'no'}
                  onClick={() => {
                    const el = speech.current;
                    if (!el) return;
                    if (speaking) {
                      el.pause();
                      el.currentTime = 0;
                      setSpeaking(false);
                      return;
                    }
                    setSpeechEl(el);
                    setSpeaking(true);
                    void el.play();
                  }}
                  className="lf-caption rounded-sm border border-primary bg-primary-soft px-3 py-1.5 font-semibold text-content"
                >
                  {speaking ? 'stop' : 'speak'}
                </button>
              ) : null}
              {composed ? (
                <button
                  type="button"
                  data-framing={framing}
                  onClick={() => setFraming((v) => (v === 'vignette' ? 'conversation' : 'vignette'))}
                  className="lf-caption rounded-sm border border-primary bg-primary-soft px-3 py-1.5 font-semibold text-content"
                >
                  {framing}
                </button>
              ) : null}
              {composed
                ? (Object.keys(CHARACTER_ASSETS) as CharacterId[]).map((id) => (
                    <button
                      key={`lead-${id}`}
                      type="button"
                      data-lead={id}
                      onClick={() => setLead(id)}
                      className={
                        id === lead
                          ? 'lf-caption rounded-sm border border-primary bg-primary-soft px-3 py-1.5 font-semibold text-content'
                          : 'lf-caption rounded-sm border border-outline px-3 py-1.5 font-semibold text-content'
                      }
                    >
                      lead: {id}
                    </button>
                  ))
                : null}
              {composed
                ? (Object.keys(SCENE_ASSETS) as Array<keyof typeof SCENE_ASSETS>).map((id) => (
                    <button
                      key={`stage-${id}`}
                      type="button"
                      data-stage={id}
                      onClick={() => setStage(id)}
                      className={
                        id === stage
                          ? 'lf-caption rounded-sm border border-primary bg-primary-soft px-3 py-1.5 font-semibold text-content'
                          : 'lf-caption rounded-sm border border-outline px-3 py-1.5 font-semibold text-content'
                      }
                    >
                      stage: {id}
                    </button>
                  ))
                : null}
              {composed
                ? CHARACTER_EMOTIONS.map((name) => (
                    <button
                      key={`emotion-${name}`}
                      type="button"
                      data-emotion={name}
                      onClick={() => setEmotion(name)}
                      className={
                        name === emotion
                          ? 'lf-caption rounded-sm border border-primary bg-primary-soft px-3 py-1.5 font-semibold text-content'
                          : 'lf-caption rounded-sm border border-outline px-3 py-1.5 font-semibold text-content'
                      }
                    >
                      {name}
                    </button>
                  ))
                : null}
              {composed
                ? VISEMES.map((name, index) => (
                    <button
                      key={`viseme-${name}`}
                      type="button"
                      data-viseme={name}
                      onClick={() => setViseme(index)}
                      className={
                        index === viseme
                          ? 'lf-caption rounded-sm border border-primary bg-primary-soft px-3 py-1.5 font-semibold text-content'
                          : 'lf-caption rounded-sm border border-outline px-3 py-1.5 font-semibold text-content'
                      }
                    >
                      {name}
                    </button>
                  ))
                : null}
              <label className="lf-caption inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 py-2 font-semibold text-on-accent">
                <input type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={onPick} />
                {t('tutor.lab.loadModel')}
              </label>
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setFileBytes(undefined);
                    setModelUrl(preset.url);
                  }}
                  className="lf-caption rounded-sm border border-outline px-3 py-1.5 font-semibold text-content"
                >
                  {preset.id}
                </button>
              ))}
              {!modelUrl ? <p className="lf-caption text-content-muted">{t('tutor.lab.noModel')}</p> : null}
            </div>
          </div>

          <aside className="space-y-6">
            <section>
              <h2 className="lf-title mb-2 text-content">{t('tutor.lab.runtime')}</h2>
              <Row label={t('tutor.lab.tier')} value={stats?.tier ?? unknown} />
              <Row label={t('tutor.lab.fps')} value={stats ? nf.format(stats.fps) : unknown} />
              <Row label={t('tutor.lab.pixelRatio')} value={stats ? stats.pixelRatio.toFixed(2) : unknown} />
              {/* Lip-sync has to be OBSERVABLE, not inferred from a squint at a
                  few dozen pixels of mouth. This is the value the stage is
                  actually being driven with. */}
              <Row
                label="viseme"
                value={`${VISEMES[speaking ? spokenViseme : viseme] ?? '—'}${speaking ? ' (speaking)' : ''}`}
              />
              {stats?.locked ? <p className="lf-caption mt-2 text-warning-strong">{t('tutor.lab.locked')}</p> : null}
            </section>

            <section>
              <h2 className="lf-title mb-2 text-content">{t('tutor.lab.budget')}</h2>
              {readings.map((reading) => (
                <Row
                  key={reading.line}
                  label={t(`tutor.lab.${reading.line === 'fileBytes' ? 'fileSize' : reading.line}`)}
                  tone={reading.over ? 'over' : 'ok'}
                  value={
                    reading.line === 'fileBytes'
                      ? `${(reading.actual / 1024 / 1024).toFixed(2)} / ${(reading.limit / 1024 / 1024).toFixed(0)} MB`
                      : `${nf.format(reading.actual)} / ${nf.format(reading.limit)}`
                  }
                />
              ))}
              {readings.length > 0 ? (
                <p className={readings.some((r) => r.over) ? 'lf-caption mt-2 text-error-strong' : 'lf-caption mt-2 text-success-strong'}>
                  {readings.some((r) => r.over) ? t('tutor.lab.budgetOver') : t('tutor.lab.budgetOk')}
                </p>
              ) : null}
              <p className="lf-caption mt-2 text-content-muted">
                {t('tutor.lab.maxTexture')}: {nf.format(TUTOR_ASSET_BUDGET.maxTextureSize)}
              </p>
            </section>

            <section>
              <h2 className="lf-title mb-2 text-content">{t('tutor.lab.device')}</h2>
              <Row label={t('tutor.lab.webgl')} value={probe.webgl} />
              <Row label={t('tutor.lab.cores')} value={probe.cores === null ? unknown : nf.format(probe.cores)} />
              <Row
                label={t('tutor.lab.memory')}
                value={probe.memoryGb === null ? unknown : `${nf.format(probe.memoryGb)} GB`}
              />
              <Row
                label={t('tutor.lab.maxTexture')}
                value={probe.maxTextureSize === null ? unknown : nf.format(probe.maxTextureSize)}
              />
              <Row
                label={t('tutor.lab.pointer')}
                value={probe.coarsePointer ? t('tutor.lab.pointerCoarse') : t('tutor.lab.pointerFine')}
              />
              <Row
                label={t('tutor.lab.reducedMotion')}
                value={probe.prefersReducedMotion ? t('tutor.lab.yes') : t('tutor.lab.no')}
              />
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
