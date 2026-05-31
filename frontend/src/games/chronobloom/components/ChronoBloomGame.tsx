import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';

import { gameReducer, createInitialState } from '../gameReducer';
import {
  GAME_CONFIG, AUDIO, CANVAS_W, CANVAS_H, HUD_H, TOOLBAR_H,
  canvasToGrid, getCellCenter,
} from '../constants';
import type { PlantType } from '../types';

import GameCanvas from './GameCanvas';
import GameHUD from './GameHUD';
import PlantToolbar from './PlantToolbar';
import PlantInfoPanel from './PlantInfoPanel';
import GameStartScreen from './GameStartScreen';
import TutorialOverlay from './TutorialOverlay';
import YearResultScreen from './YearResultScreen';
import LevelCompleteScreen from './LevelCompleteScreen';
import GameOverScreen from './GameOverScreen';
import VictoryScreen from './VictoryScreen';
import PauseOverlay from './PauseOverlay';
import PonziOverlay from './PonziOverlay';

export default function ChronoBloomGame() {
  const { t } = useTranslation('chronoBloom');
  const { playBGM, stopBGM, playFile } = useSound();

  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [hoveredCell, setHoveredCell] = useState<{ col: number; row: number } | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  // ── Scale to fit window ──────────────────────────────────────────────────
  useEffect(() => {
    function recalcScale() {
      const sw = window.innerWidth / CANVAS_W;
      const sh = window.innerHeight / CANVAS_H;
      setScale(Math.min(sw, sh, 1.5));
    }
    recalcScale();
    window.addEventListener('resize', recalcScale);
    return () => window.removeEventListener('resize', recalcScale);
  }, []);

  // ── CSS variable for scale ───────────────────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (el) el.style.setProperty('--cb-scale', String(scale));
  }, [scale]);

  // ── Game Loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase === 'PLAYING') {
      tickRef.current = setInterval(() => {
        dispatch({ type: 'TICK' });
      }, GAME_CONFIG.tickMs);
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state.phase]);

  // ── Greenhouse shake when hit ────────────────────────────────────────────
  const prevGHHp = useRef(state.greenhouseHp);
  useEffect(() => {
    if (state.greenhouseHp < prevGHHp.current) {
      setIsShaking(true);
      playFile(AUDIO.greenhouseHit);
      setTimeout(() => setIsShaking(false), 350);
    }
    prevGHHp.current = state.greenhouseHp;
  }, [state.greenhouseHp]);

  // ── BGM ──────────────────────────────────────────────────────────────────
  const hasBossOnField = state.enemies.some(e => e.type === 'deficit_king');
  useEffect(() => {
    if (state.phase === 'PLAYING') {
      const track = hasBossOnField ? AUDIO.bgmBoss : AUDIO.bgm;
      playBGM(track, { volume: 0.2 });
    } else if (state.phase === 'GAME_OVER') {
      stopBGM({ fade: true });
      playFile(AUDIO.gameOver);
    } else if (state.phase === 'VICTORY') {
      stopBGM({ fade: true });
      playFile(AUDIO.victory);
    } else if (state.phase === 'START') {
      stopBGM({ fade: true, fadeDuration: 1200 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, hasBossOnField]);

  // ── Sound on interest earning ────────────────────────────────────────────
  const prevCapital = useRef(state.capital);
  useEffect(() => {
    if (state.phase === 'YEAR_RESULT' && (state.yearResultData?.totalInterestEarned ?? 0) > 0) {
      playFile(AUDIO.interestEarn);
    }
    if (state.phase === 'YEAR_RESULT' && state.yearResultData?.bearMarketOccurred) {
      playFile(AUDIO.bearMarket);
    }
  }, [state.phase]);

  // ── Keyboard Controls ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (stateRef.current.phase === 'PLAYING') dispatch({ type: 'PAUSE' });
        else if (stateRef.current.phase === 'PAUSED') dispatch({ type: 'RESUME' });
        return;
      }
      // Number keys 1-4: select plant
      if (state.phase === 'PLANNING') {
        if (e.key === '1') dispatch({ type: 'SELECT_PLANT_TYPE', plantType: 'savings_sprout' });
        if (e.key === '2') dispatch({ type: 'SELECT_PLANT_TYPE', plantType: 'stock_tree' });
        if (e.key === '3') dispatch({ type: 'SELECT_PLANT_TYPE', plantType: 'div_vine' });
        if (e.key === '4') dispatch({ type: 'SELECT_PLANT_TYPE', plantType: 'emergency_cactus' });
        if (e.key === 'Enter' && stateRef.current.plants.length > 0) {
          dispatch({ type: 'ADVANCE_YEAR' });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase]);

  // ── Canvas Click ─────────────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const rawY = (e.clientY - rect.top) * (CANVAS_H / rect.height);

    const s = stateRef.current;

    // Collect capital drops during PLAYING
    if (s.phase === 'PLAYING') {
      for (const drop of s.capitalDrops) {
        if (Math.abs(drop.x - rawX) < 22 && Math.abs(drop.y - rawY) < 22) {
          dispatch({ type: 'COLLECT_DROP', dropId: drop.id });
          playFile(AUDIO.coinCollect);
          return;
        }
      }
      return;
    }

    if (s.phase !== 'PLANNING') return;

    // Check if click is on an existing plant
    if (!s.selectedPlantType) {
      const clickedPlant = s.plants.find(p => {
        const { cx, cy } = getCellCenter(p.col, p.row);
        return Math.abs(cx - rawX) < 36 && Math.abs(cy - rawY) < 36;
      });
      if (clickedPlant) {
        dispatch({ type: 'SELECT_PLANT', plantId: clickedPlant.id === s.selectedPlantId ? null : clickedPlant.id });
        return;
      }
      dispatch({ type: 'SELECT_PLANT', plantId: null });
      return;
    }

    // Place plant
    const cell = canvasToGrid(rawX, rawY);
    if (cell) {
      dispatch({ type: 'PLACE_PLANT', col: cell.col, row: cell.row });
      playFile(AUDIO.plantPlace);
    }
  }, []);

  // ── Canvas Mouse Move (hover) ─────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (stateRef.current.phase !== 'PLANNING' || !stateRef.current.selectedPlantType) {
      setHoveredCell(null);
      return;
    }
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const rawY = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    const cell = canvasToGrid(rawX, rawY);
    setHoveredCell(cell);
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredCell(null), []);

  // ── Selected plant info ───────────────────────────────────────────────────
  const selectedPlant = state.selectedPlantId
    ? state.plants.find(p => p.id === state.selectedPlantId)
    : null;

  return (
    <div className="cb-fullscreen">
      <div
        ref={wrapperRef}
        className={`cb-scale-wrapper ${isShaking ? 'cb-shake' : ''}`}
      >
        {/* Canvas (always rendered as base layer) */}
        <GameCanvas
          state={state}
          hoveredCell={hoveredCell}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* HUD */}
        {state.phase !== 'START' && state.phase !== 'TUTORIAL' && (
          <GameHUD
            state={state}
            onPause={() => {
              if (state.phase === 'PLAYING') dispatch({ type: 'PAUSE' });
            }}
          />
        )}

        {/* Toolbar */}
        {state.phase !== 'START' && state.phase !== 'TUTORIAL' &&
         state.phase !== 'GAME_OVER' && state.phase !== 'VICTORY' && (
          <PlantToolbar
            state={state}
            onSelectPlant={(type: PlantType | null) => dispatch({ type: 'SELECT_PLANT_TYPE', plantType: type })}
            onAdvanceYear={() => {
              dispatch({ type: 'ADVANCE_YEAR' });
              playFile(AUDIO.yearAdvance);
            }}
          />
        )}

        {/* Plant Info Panel (click on plant to see) */}
        {selectedPlant && (state.phase === 'PLANNING' || state.phase === 'PLAYING') && (
          <PlantInfoPanel
            plant={selectedPlant}
            state={state}
            scale={scale}
            onLiquidate={() => {
              dispatch({ type: 'LIQUIDATE_PLANT', plantId: selectedPlant.id });
              playFile(AUDIO.plantSell);
            }}
            onUnfreeze={() => dispatch({ type: 'UNFREEZE_PLANT', plantId: selectedPlant.id })}
            onClose={() => dispatch({ type: 'SELECT_PLANT', plantId: null })}
          />
        )}

        {/* ── Phase Overlays ── */}
        {state.phase === 'START' && (
          <GameStartScreen
            state={state}
            onStart={() => dispatch({ type: 'START_GAME' })}
          />
        )}

        {state.phase === 'TUTORIAL' && (
          <TutorialOverlay
            state={state}
            onNext={() => dispatch({ type: 'TUTORIAL_NEXT' })}
            onSkip={() => dispatch({ type: 'SKIP_TUTORIAL' })}
          />
        )}

        {state.phase === 'YEAR_RESULT' && (
          <YearResultScreen
            state={state}
            onContinue={() => dispatch({ type: 'ACKNOWLEDGE_YEAR_RESULT' })}
          />
        )}

        {state.phase === 'LEVEL_COMPLETE' && (
          <LevelCompleteScreen
            state={state}
            onNext={() => dispatch({ type: 'NEXT_LEVEL' })}
          />
        )}

        {state.phase === 'GAME_OVER' && (
          <GameOverScreen
            state={state}
            onRestart={() => dispatch({ type: 'RESTART' })}
          />
        )}

        {state.phase === 'VICTORY' && (
          <VictoryScreen
            state={state}
            onPlayAgain={() => dispatch({ type: 'RESTART' })}
          />
        )}

        {state.phase === 'PAUSED' && (
          <PauseOverlay
            onResume={() => dispatch({ type: 'RESUME' })}
            onRestart={() => dispatch({ type: 'RESTART' })}
          />
        )}

        {/* Ponzi Easter Egg */}
        {state.ponziVisible && (
          <PonziOverlay
            capital={state.capital}
            onDecline={() => dispatch({ type: 'DECLINE_PONZI' })}
            onAccept={() => dispatch({ type: 'ACCEPT_PONZI' })}
          />
        )}
      </div>
    </div>
  );
}
