/* ──────────────────────────────────────────────────────────────
   Runner Phase – 2D side-scrolling collection phase
   ────────────────────────────────────────────────────────────── */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, GAME_CONFIG } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import type { RunnerCollectible, RunnerObstacle } from '../types';

interface Props {
  day: number;
  onFinish: (lemons: number, sugar: number) => void;
  hasSqueezer: boolean;
  playSfx: (name: string) => void;
  paused?: boolean;
}

let nextId = 0;
const uid = () => `r_${nextId++}`;

/*
 * VISUAL SIZING
 * The actual visual sprite occupies ~60% of the element box.
 * The rest is transparent PNG padding. So we use MUCH tighter
 * hitboxes based on the visual content, not the element box.
 */
const PLAYER_W = 100;
const PLAYER_H = 120;
const ITEM_W = 70;
const ITEM_H = 70;
const OBSTACLE_W = 70;
const OBSTACLE_H = 70;

/*
 * PHYSICS MODEL
 * All physics use PIXELS, not percentages.
 * `groundY` is computed from the container height on every frame.
 * Player.y = absolute pixel position of the player's FEET.
 *
 * Arrow key controls (while held):
 *   ↑ / Space  → jump + variable height (hold longer = higher)
 *   ↓          → duck (reduce hitbox height, crouch sprite, slide under items)
 *   →          → speed boost  (+50 % scroll speed)
 *   ←          → slow down   (-35 % scroll speed)
 */

/* ── Physics constants (in pixels at 60 fps) ──────────────── */
const GRAVITY = 0.85;   // px/frame² — lighter than before for floatier arc
const JUMP_FORCE = -22;    // px/frame  — much stronger initial kick
const MIN_JUMP_VY = -6;     // short-hop cutoff when releasing early
const MAX_JUMP_HOLD_MS = 420;    // ms – max extra upward impulse while holding
const HOLD_IMPULSE = 0.40;   // px/frame² extra upward force while holding

/* Duck constants */
const DUCK_H_RATIO = 0.55;      // ducked player is 55 % of full height
const DUCK_INSET_X = 0.12;      // extra side inset while ducking

/* Speed modifier multipliers */
const BOOST_FACTOR = 1.55;      // right arrow: 55 % faster
const SLOW_FACTOR = 0.65;      // left  arrow: 35 % slower

export function RunnerPhase({ day, onFinish, hasSqueezer, playSfx, paused = false }: Props) {
  const { t } = useTranslation('games');
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const finishedRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const pauseStartRef = useRef(0);
  const totalPausedRef = useRef(0);

  // ── Player state — y is in PIXELS (feet position)
  const playerRef = useRef({
    y: 0,
    vy: 0,
    isJumping: false,
    frame: 0,
    initialised: false,
    jumpHoldStart: 0,   // timestamp when jump key was first pressed
    jumpHolding: false, // still holding the jump key?
    ducking: false,     // is the player ducking (↓ held)?
  });

  // ── Active keys (held-state tracking for arrow keys)
  const keysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  // Collections
  const collectiblesRef = useRef<RunnerCollectible[]>([]);
  const obstaclesRef = useRef<RunnerObstacle[]>([]);
  const lemonsRef = useRef(0);
  const sugarRef = useRef(0);
  const lastCollectSpawnRef = useRef(0);
  const lastObstacleSpawnRef = useRef(0);
  const hitCooldownRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Global animation clock for spinning/bobbing collectibles
  const animClockRef = useRef(0);

  // State for React re-renders (HUD + visual refresh)
  const [lemons, setLemons] = useState(0);
  const [sugar, setSugar] = useState(0);
  const [timeLeft, setTimeLeft] = useState(100);
  const [hitFlash, setHitFlash] = useState(false);
  const [isDucking, setIsDucking] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);
  const [isSlowing, setIsSlowing] = useState(false);
  const [, setTick] = useState(0);

  const speedMultiplier = hasSqueezer ? 1.3 : 1;
  const duration = GAME_CONFIG.runnerDurationMs;

  /* ── Jump handler (variable height) ────────────────────── */
  const handleJump = useCallback(() => {
    const p = playerRef.current;
    if (p.isJumping || p.ducking) return;
    p.vy = JUMP_FORCE;
    p.isJumping = true;
    p.jumpHolding = true;
    p.jumpHoldStart = performance.now();
    playSfx('jump');
  }, [playSfx]);

  const handleJumpRelease = useCallback(() => {
    const p = playerRef.current;
    p.jumpHolding = false;
    // Short-hop: cut upward velocity if released early
    if (p.vy < MIN_JUMP_VY) {
      p.vy = MIN_JUMP_VY;
    }
  }, []);

  /* ── Keyboard listeners (all arrow keys + space) ──────── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Space':
        case 'ArrowUp': {
          e.preventDefault();
          keysRef.current.up = true;
          if (!e.repeat) handleJump();
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (!e.repeat) {
            keysRef.current.down = true;
            playerRef.current.ducking = true;
            // Duck cancels any jump-hold
            playerRef.current.jumpHolding = false;
            setIsDucking(true);
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          keysRef.current.right = true;
          setIsBoosting(true);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          keysRef.current.left = true;
          setIsSlowing(true);
          break;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Space':
        case 'ArrowUp': {
          e.preventDefault();
          keysRef.current.up = false;
          handleJumpRelease();
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          keysRef.current.down = false;
          playerRef.current.ducking = false;
          setIsDucking(false);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          keysRef.current.right = false;
          setIsBoosting(false);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          keysRef.current.left = false;
          setIsSlowing(false);
          break;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleJump, handleJumpRelease]);

  /* ── Touch: tap = jump (mobile) ─────────────────────────── */
  // Touch controls on the container itself are handled via onPointerDown/Up
  // props on the JSX element below.

  /* ── Pause tracking ────────────────────────────────────── */
  useEffect(() => {
    if (paused) {
      pauseStartRef.current = performance.now();
    } else if (pauseStartRef.current > 0) {
      totalPausedRef.current += performance.now() - pauseStartRef.current;
      pauseStartRef.current = 0;
    }
  }, [paused]);

  /* ── Game loop ────────────────────────────────────────── */
  useEffect(() => {
    startTimeRef.current = performance.now();
    let prevTime = startTimeRef.current;

    const loop = (now: number) => {
      if (finishedRef.current) return;

      // While paused: freeze time but keep requesting frames
      if (pausedRef.current) {
        prevTime = now;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const elapsed = now - startTimeRef.current - totalPausedRef.current;
      const dt = Math.min((now - prevTime) / 16.67, 3);
      prevTime = now;

      // Animation clock for spinning / bobbing effects
      animClockRef.current += dt;

      // Time progress → HUD
      const progress = Math.min(1, elapsed / duration);
      setTimeLeft(Math.max(0, Math.round((1 - progress) * 100)));

      if (progress >= 1) {
        finishedRef.current = true;
        onFinish(lemonsRef.current, sugarRef.current);
        return;
      }

      const container = containerRef.current;
      if (!container) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const containerW = container.clientWidth;
      const containerH = container.clientHeight;
      const groundY = containerH * (GAME_CONFIG.runnerGroundY / 100);

      // ── Speed: base + difficulty + squeezer + arrow-key modifier
      const keys = keysRef.current;
      let speedMod = 1;
      if (keys.right && !keys.left) speedMod = BOOST_FACTOR;
      else if (keys.left && !keys.right) speedMod = SLOW_FACTOR;

      const scrollSpeed =
        (GAME_CONFIG.runnerSpeedBase + day * GAME_CONFIG.difficultyScaleSpeed)
        * speedMultiplier
        * speedMod
        * dt;

      // ── Initialise player on first frame
      const p = playerRef.current;
      if (!p.initialised) {
        p.y = groundY;
        p.initialised = true;
      }

      // ── Duck: don't apply gravity boost, but cancel jump-hold
      if (p.ducking && p.isJumping) {
        // Allow early land by forcing vy downward
        p.vy = Math.max(p.vy, 4);
        p.jumpHolding = false;
      }

      // ── Variable jump: hold adds upward impulse up to MAX_JUMP_HOLD_MS
      if (p.jumpHolding && p.isJumping && p.vy < 0) {
        const holdDuration = now - p.jumpHoldStart;
        if (holdDuration < MAX_JUMP_HOLD_MS) {
          p.vy -= HOLD_IMPULSE * dt;
        } else {
          p.jumpHolding = false;
        }
      }

      // ── Physics (pixels)
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;

      // Ceiling clamp (can't go above 8 % of container)
      const ceilPx = containerH * 0.08 + PLAYER_H;
      if (p.y < ceilPx) {
        p.y = ceilPx;
        if (p.vy < 0) p.vy = 0;
        p.jumpHolding = false;
      }

      // Ground landing
      if (p.y >= groundY) {
        p.y = groundY;
        p.vy = 0;
        p.isJumping = false;
        p.jumpHolding = false;
      }

      // Walk animation frame
      p.frame = (p.frame + 0.15 * dt) % 2;

      // ── Spawn collectibles
      if (now - lastCollectSpawnRef.current > GAME_CONFIG.collectibleSpawnIntervalMs / speedMultiplier) {
        lastCollectSpawnRef.current = now;
        const type = Math.random() > 0.5 ? 'lemon' : 'sugar';

        // 3 vertical lanes — lane probabilities balanced for new jump height
        const lane = Math.random();
        let itemY: number;
        if (lane < 0.38) {
          // Ground lane — very easy
          itemY = groundY - ITEM_H - 5;
        } else if (lane < 0.72) {
          // Mid lane — normal jump reaches easily
          itemY = groundY - PLAYER_H * 1.5 - ITEM_H;
        } else {
          // High lane — requires hold-jump (now reachable with JUMP_FORCE=-22)
          itemY = groundY - PLAYER_H * 2.6 - ITEM_H;
        }
        itemY = Math.max(containerH * 0.05, itemY);

        // Random visual properties — spinning increases with day
        const spinBase = Math.min(day * 0.3, 2.5);
        collectiblesRef.current.push({
          id: uid(),
          type,
          x: containerW + 20,
          y: itemY,
          width: ITEM_W,
          height: ITEM_H,
          collected: false,
          rotation: Math.random() * 360,
          scale: 0.85 + Math.random() * 0.3,
          bobOffset: Math.random() * Math.PI * 2,
          spinSpeed: spinBase > 0 ? (0.5 + Math.random() * spinBase) : 0,
        });
      }

      // ── Spawn obstacles
      // Base interval from config, scaling a bit with day
      const baseObstacleInterval = GAME_CONFIG.obstacleSpawnIntervalMs / (1 + day * 0.08);
      // Introduce heavy randomness: ± 40% of the base interval for unpredictable spawning
      const minInterval = baseObstacleInterval * 0.6;
      const maxInterval = baseObstacleInterval * 1.4;

      // Store the target interval to hit for the NEXT obstacle (we calculate it randomly each time we spawn one)
      if (!lastObstacleSpawnRef.current) {
        lastObstacleSpawnRef.current = now;
        // Temporary variable using the object ref to store the random target locally (TypeScript hack: just use another ref normally, but we'll attach it to the ref obj for speed)
        (lastObstacleSpawnRef as any).targetInterval = minInterval + Math.random() * (maxInterval - minInterval);
      }

      if (now - lastObstacleSpawnRef.current > ((lastObstacleSpawnRef as any).targetInterval || baseObstacleInterval)) {
        lastObstacleSpawnRef.current = now;
        // Generate the NEXT interval
        (lastObstacleSpawnRef as any).targetInterval = minInterval + Math.random() * (maxInterval - minInterval);

        const obstacleType = Math.random() > 0.5 ? 'rock' : 'mushroom';
        const scale = 0.9 + Math.random() * 0.25;
        obstaclesRef.current.push({
          id: uid(),
          x: containerW + 20,
          y: groundY - OBSTACLE_H * scale,
          width: OBSTACLE_W,
          height: OBSTACLE_H,
          obstacleType,
          scale,
          rotation: (Math.random() - 0.5) * 12, // slight tilt ±6°
        });
      }

      // ── Move items left (scroll speed × 2.5 for items)
      const moveSpeed = scrollSpeed * 2.5;
      collectiblesRef.current = collectiblesRef.current
        .map((c) => ({ ...c, x: c.x - moveSpeed }))
        .filter((c) => c.x > -ITEM_W - 10);

      obstaclesRef.current = obstaclesRef.current
        .map((o) => ({ ...o, x: o.x - moveSpeed }))
        .filter((o) => o.x > -OBSTACLE_W - 10);

      // ── Player hitbox — tight to match visible sprite
      const playerX = containerW * 0.15;
      const duckH = p.ducking ? PLAYER_H * DUCK_H_RATIO : PLAYER_H;
      // When ducking, feet stay at groundY; top rises
      const playerTopPx = p.y - duckH;
      const hbInsetX = PLAYER_W * (p.ducking ? 0.28 + DUCK_INSET_X : 0.28);
      const hbInsetTop = duckH * 0.15;
      const hbInsetBot = duckH * 0.05;
      const px1 = playerX + hbInsetX;
      const px2 = playerX + PLAYER_W - hbInsetX;
      const py1 = playerTopPx + hbInsetTop;
      const py2 = p.y - hbInsetBot;

      // ── Collectible collision — generous hitbox (easier to grab)
      let collected = false;
      collectiblesRef.current.forEach((c) => {
        if (c.collected) return;
        const inset = c.width * 0.15;
        const cx1 = c.x + inset;
        const cx2 = c.x + c.width - inset;
        const cy1 = c.y + inset;
        const cy2 = c.y + c.height - inset;

        if (px1 < cx2 && px2 > cx1 && py1 < cy2 && py2 > cy1) {
          c.collected = true;
          collected = true;
          if (c.type === 'lemon') {
            lemonsRef.current++;
            setLemons(lemonsRef.current);
          } else {
            sugarRef.current++;
            setSugar(sugarRef.current);
          }
          playSfx('coinCollect');
        }
      });
      if (collected) {
        collectiblesRef.current = collectiblesRef.current.filter((c) => !c.collected);
      }

      // ── Obstacle collision — tight hitbox to prevent phantom hits
      if (!hitCooldownRef.current) {
        obstaclesRef.current.forEach((o) => {
          const visualW = o.width * o.scale;
          const visualH = o.height * o.scale;
          const insetX = visualW * 0.30;
          const insetTop = visualH * 0.25;
          const insetBot = visualH * 0.10;
          const ox1 = o.x + insetX;
          const ox2 = o.x + visualW - insetX;
          const oy1 = o.y + insetTop;
          const oy2 = o.y + visualH - insetBot;

          if (px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1) {
            hitCooldownRef.current = true;
            lemonsRef.current = Math.max(0, lemonsRef.current - 1);
            sugarRef.current = Math.max(0, sugarRef.current - 1);
            setLemons(lemonsRef.current);
            setSugar(sugarRef.current);
            playSfx('hit');
            setHitFlash(true);
            timeoutsRef.current.push(setTimeout(() => setHitFlash(false), 350));
            timeoutsRef.current.push(setTimeout(() => { hitCooldownRef.current = false; }, 1200));
          }
        });
      }

      setTick((prev) => prev + 1);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, speedMultiplier, duration]);

  /* ── Player sprite selection ───────────────────────────── */
  const p = playerRef.current;
  const containerH_render = containerRef.current?.clientHeight ?? 600;
  const groundYPx = containerH_render * (GAME_CONFIG.runnerGroundY / 100);
  const isInAir = p.isJumping || (p.initialised && p.y < groundYPx - 2);

  let playerSrc: string;
  if (isInAir) {
    playerSrc = PICTURES.lirufJump;
  } else {
    playerSrc = Math.floor(p.frame) === 0 ? PICTURES.lirufRun1 : PICTURES.lirufRun2;
  }

  /* ── Compute player top for render ─────────────────────── */
  const duckH_render = p.ducking ? PLAYER_H * DUCK_H_RATIO : PLAYER_H;
  const playerTopRender = (p.initialised ? p.y : groundYPx) - duckH_render;

  /* ── Animation clock for render transforms ─────────────── */
  const clock = animClockRef.current;

  return (
    <div
      ref={containerRef}
      className="nectar-runner"
      onPointerDown={handleJump}
      onPointerUp={handleJumpRelease}
      onPointerCancel={handleJumpRelease}
      style={{ touchAction: 'none' }}
    >
      {/* Background */}
      <div
        className="nectar-runner-bg"
        style={{ backgroundImage: `url(${PICTURES.bgRunner})` }}
      />

      {/* Red flash on obstacle hit */}
      {hitFlash && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,0,0,0.35)',
            zIndex: 50,
            pointerEvents: 'none',
            borderRadius: 'inherit',
          }}
        />
      )}

      {/* Speed indicator badges */}
      {isBoosting && !isSlowing && (
        <div className="nectar-speed-badge nectar-speed-boost">
          ⚡ {t('nectar.runner.speedBoost')}
        </div>
      )}
      {isSlowing && !isBoosting && (
        <div className="nectar-speed-badge nectar-speed-slow">
          🐢 {t('nectar.runner.speedSlow')}
        </div>
      )}
      {isDucking && (
        <div className="nectar-speed-badge nectar-speed-duck">
          ⬇ {t('nectar.runner.ducking')}
        </div>
      )}

      {/* Ground line */}
      <div className="nectar-runner-ground" style={{ top: `${GAME_CONFIG.runnerGroundY}%` }} />

      {/* Player */}
      <div
        className={`nectar-runner-player${p.ducking ? ' nectar-runner-player-duck' : ''}`}
        style={{
          left: '15%',
          top: playerTopRender,
          width: PLAYER_W,
          height: duckH_render,
          position: 'absolute',
          zIndex: 10,
          transition: 'none',
        }}
      >
        <AssetImg assetPath={playerSrc} alt="Liruf" className="nectar-runner-player-img" />
      </div>

      {/* Collectibles — with random visual variety */}
      {collectiblesRef.current.map((c) => {
        const spin = c.spinSpeed > 0 ? (c.rotation + clock * c.spinSpeed * 8) % 360 : c.rotation;
        const bob = Math.sin(clock * 0.08 + c.bobOffset) * 5;
        const transform = `rotate(${spin}deg) scale(${c.scale})`;

        return (
          <div
            key={c.id}
            className={`nectar-runner-collectible nectar-runner-collectible-${c.type}`}
            style={{
              position: 'absolute',
              left: c.x,
              top: c.y + bob,
              width: ITEM_W,
              height: ITEM_H,
              transform,
              transformOrigin: 'center center',
              willChange: 'transform',
            }}
          >
            <AssetImg
              assetPath={c.type === 'lemon' ? PICTURES.lemon : PICTURES.sugar}
              alt={c.type}
              className="nectar-runner-collectible-img"
            />
          </div>
        );
      })}

      {/* Obstacles — with random type, scale, and tilt */}
      {obstaclesRef.current.map((o) => (
        <div
          key={o.id}
          className="nectar-runner-obstacle"
          style={{
            position: 'absolute',
            left: o.x,
            top: o.y,
            width: OBSTACLE_W * o.scale,
            height: OBSTACLE_H * o.scale,
            transform: `rotate(${o.rotation}deg)`,
            transformOrigin: 'center bottom',
          }}
        >
          <AssetImg
            assetPath={o.obstacleType === 'rock' ? PICTURES.rock : PICTURES.mushroom}
            alt="obstacle"
            className="nectar-runner-obstacle-img"
          />
        </div>
      ))}

      {/* HUD overlay */}
      <div className="nectar-runner-hud">
        <div className="nectar-runner-hud-row">
          <span className="nectar-runner-day">{t('nectar.runner.day', { day })}</span>
          <div className="nectar-runner-timer">
            <div className="nectar-runner-timer-bar" style={{ width: `${timeLeft}%` }} />
          </div>
        </div>
        <div className="nectar-runner-hud-row">
          <span className="nectar-runner-count">
            <AssetImg assetPath={PICTURES.lemon} alt="" className="nectar-icon-sm" /> {lemons}
          </span>
          <span className="nectar-runner-count">
            <AssetImg assetPath={PICTURES.sugar} alt="" className="nectar-icon-sm" /> {sugar}
          </span>
        </div>
      </div>

      {/* Control hint (bottom) */}
      <div className="nectar-runner-hint">
        {t('nectar.runner.controlHint')}
      </div>
    </div>
  );
}
