import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';

import { gameReducer, createInitialState } from '../gameReducer';
import { GAME_CONFIG, AUDIO } from '../constants';
import type { TowerType } from '../types';

import GameStartScreen from './GameStartScreen';
import TutorialOverlay from './TutorialOverlay';
import InboxPhase from './InboxPhase';
import GameHUD from './GameHUD';
import GameMap from './GameMap';
import TowerToolbar from './TowerToolbar';
import TwoFAPrompt from './TwoFAPrompt';
import UpgradeMinigame from './UpgradeMinigame';
import LevelResult from './LevelResult';
import GameOverScreen from './GameOverScreen';
import PauseOverlay from './PauseOverlay';

export default function HackerDefenseGame() {
  const { t } = useTranslation('games');
  const { playBGM, stopBGM, playFile } = useSound();
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);

  stateRef.current = state;

  // ── Game Loop ──────────────────────────────────────────────────────
  const startTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      if (stateRef.current.phase === 'PLAYING') {
        dispatch({ type: 'TICK' });
      }
    }, GAME_CONFIG.tickMs);
  }, []);

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (state.phase === 'PLAYING') {
      startTick();
    } else {
      stopTick();
    }
    return stopTick;
  }, [state.phase, startTick, stopTick]);

  // ── Inbox Timer (auto-timeout if player doesn't decide) ────────────
  useEffect(() => {
    if (state.phase !== 'INBOX' || state.inboxDecision !== null) return;
    const timer = setTimeout(() => {
      // Auto-timeout: treat as wrong answer (trust a phishing)
      dispatch({ type: 'INBOX_PREVIEW_DECIDE', decision: 'trust' });
    }, GAME_CONFIG.inboxTimerTicks * GAME_CONFIG.tickMs);
    return () => clearTimeout(timer);
  }, [state.phase, state.inboxDecision]);

  // Auto-proceed from inbox after preview decision (2.2s feedback)
  useEffect(() => {
    if (state.phase !== 'INBOX' || state.inboxDecision === null) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'INBOX_DECIDE' });
    }, 2200);
    return () => clearTimeout(timer);
  }, [state.inboxDecision, state.phase]);

  // ── BGM ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase === 'PLAYING') {
      const isTense = state.bankBalance < state.maxBankBalance * 0.2;
      const hasBoss = state.enemies.some(e => e.type === 'boss');
      const track = hasBoss ? AUDIO.bgmBoss : isTense ? AUDIO.bgmTense : AUDIO.bgm;
      playBGM(track, { volume: 0.18 });
    } else if (state.phase === 'GAME_OVER') {
      stopBGM({ fade: true });
      playFile(AUDIO.gameOver);
    } else if (state.phase === 'VICTORY') {
      stopBGM({ fade: true });
      playFile(AUDIO.victory);
    } else if (state.phase === 'START') {
      stopBGM({ fade: true, fadeDuration: 1000 });
    }
  }, [state.phase, state.bankBalance]);

  // Sound for actions
  useEffect(() => {
    if (state.twoFA !== null) {
      playFile(AUDIO.alert);
    }
  }, [state.twoFA !== null]);

  // ── Keyboard Controls ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (state.phase === 'PLAYING') {
          dispatch({ type: 'ACTION_COMMAND' });
          playFile(AUDIO.critical);
        }
      }
      if (e.code === 'Escape') {
        if (state.phase === 'PLAYING') dispatch({ type: 'PAUSE' });
        else if (state.phase === 'PAUSED') dispatch({ type: 'RESUME' });
      }
      // 2FA keyboard input
      if (state.twoFA && state.phase === 'PLAYING') {
        if (e.key >= '0' && e.key <= '9') {
          dispatch({ type: 'TYPE_2FA', char: e.key });
          playFile(AUDIO.clack);
        }
        if (e.key === 'Backspace') {
          dispatch({ type: 'TYPE_2FA', char: 'BACKSPACE' });
        }
        if (e.key === 'Enter') {
          dispatch({ type: 'SUBMIT_2FA' });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.phase, state.twoFA]);

  // ── Sound effects on state changes ────────────────────────────────
  const prevScoreRef = useRef(state.score);
  useEffect(() => {
    if (state.score > prevScoreRef.current) {
      // Enemy killed
    }
    prevScoreRef.current = state.score;
  }, [state.score]);

  // ── 2FA TYPE_2FA: Handle BACKSPACE logic in reducer ────────────────
  // Note: BACKSPACE is sent as special char 'BACKSPACE' and handled below
  // We intercept it in the reducer's TYPE_2FA case — handled differently.

  // ── Scale to Fit Screen ────────────────────────────────────────────
  const [scale] = useScaleToFit(900, 540);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="hd-fullscreen">
      <div
        className="hd-scale-wrapper"
        style={{ '--hd-scale': scale } as React.CSSProperties}
      >
        {/* START */}
        {state.phase === 'START' && (
          <GameStartScreen state={state} onStart={() => dispatch({ type: 'START_GAME' })} />
        )}

        {/* TUTORIAL */}
        {state.phase === 'TUTORIAL' && (
          <TutorialOverlay
            step={state.tutorialStep}
            onNext={() => dispatch({ type: 'TUTORIAL_NEXT' })}
            onSkip={() => dispatch({ type: 'SKIP_TUTORIAL' })}
          />
        )}

        {/* INBOX */}
        {state.phase === 'INBOX' && (
          <InboxPhase
            email={state.inboxEmail}
            timer={state.inboxTimer}
            level={state.level}
            inboxDecision={state.inboxDecision}
            onPreviewDecide={(decision) => dispatch({ type: 'INBOX_PREVIEW_DECIDE', decision })}
          />
        )}

        {/* PLAYING (Game in progress) */}
        {(state.phase === 'PLAYING' || state.phase === 'PAUSED') && (
          <>
            {/* HUD */}
            <GameHUD state={state} onPause={() => dispatch({ type: 'PAUSE' })} />

            {/* Map */}
            <GameMap
              state={state}
              onPlaceTower={(slotId) => {
                dispatch({ type: 'PLACE_TOWER', slotId });
                playFile(AUDIO.place);
              }}
              onMarkPhishing={(enemyId) => {
                dispatch({ type: 'MARK_PHISHING', enemyId });
                playFile(AUDIO.phishingAlert);
              }}
              onCollectPacket={(packetId) => {
                dispatch({ type: 'COLLECT_PACKET', packetId });
                playFile(AUDIO.caching);
              }}
              onCloseBossPopup={(id) => dispatch({ type: 'CLOSE_BOSS_POPUP', popupId: id })}
              onRequestUpgrade={(towerId) => dispatch({ type: 'REQUEST_UPGRADE', towerId })}
            />

            {/* Tower Toolbar */}
            <TowerToolbar
              dataPoints={state.dataPoints}
              selectedTowerType={state.selectedTowerType}
              onSelect={(type) => dispatch({ type: 'SELECT_TOWER_TYPE', towerType: type })}
              actionCommandWindow={state.actionCommandWindow}
            />

            {/* 2FA Prompt */}
            {state.twoFA && state.phase === 'PLAYING' && (
              <TwoFAPrompt
                twoFA={state.twoFA}
                onType={(char) => {
                  if (char === 'BACKSPACE') {
                    // handled specially
                    dispatch({ type: 'TYPE_2FA', char: 'BACKSPACE' });
                  } else {
                    dispatch({ type: 'TYPE_2FA', char });
                    playFile(AUDIO.clack);
                  }
                }}
                onSubmit={() => {
                  const success = state.twoFA?.inputCode === state.twoFA?.code;
                  dispatch({ type: 'SUBMIT_2FA' });
                  playFile(success ? AUDIO.twoFASuccess : AUDIO.twoFAFail);
                }}
                onCancel={() => dispatch({ type: 'CANCEL_2FA' })}
              />
            )}

            {/* Pause */}
            {state.phase === 'PAUSED' && (
              <PauseOverlay
                onResume={() => dispatch({ type: 'RESUME' })}
                onRestart={() => dispatch({ type: 'RESTART' })}
              />
            )}
          </>
        )}

        {/* UPGRADE MINIGAME */}
        {state.phase === 'UPGRADE_MINIGAME' && state.upgradeMinigame && (
          <>
            {/* Still show HUD + Map in background */}
            <GameHUD state={state} onPause={() => {}} />
            <GameMap
              state={state}
              onPlaceTower={() => {}}
              onMarkPhishing={() => {}}
              onCollectPacket={() => {}}
              onCloseBossPopup={() => {}}
              onRequestUpgrade={() => {}}
            />
            <TowerToolbar
              dataPoints={state.dataPoints}
              selectedTowerType={null}
              onSelect={() => {}}
              actionCommandWindow={0}
            />
            <UpgradeMinigame
              minigame={state.upgradeMinigame}
              onConfirm={(password) => {
                dispatch({ type: 'CONFIRM_UPGRADE', password });
                playFile(AUDIO.levelUp);
              }}
              onCancel={() => dispatch({ type: 'CANCEL_UPGRADE' })}
            />
          </>
        )}

        {/* LEVEL RESULT */}
        {state.phase === 'LEVEL_RESULT' && (
          <LevelResult
            level={state.level}
            stats={state.levelStats}
            maxBalance={state.maxBankBalance}
            score={state.score}
            isVictory={false}
            onNext={() => dispatch({ type: 'NEXT_LEVEL' })}
            onRestart={() => dispatch({ type: 'RESTART' })}
          />
        )}

        {/* VICTORY */}
        {state.phase === 'VICTORY' && (
          <div className="hd-overlay">
            <div className="hd-card" style={{ maxWidth: 460, textAlign: 'center' }}>
              {/* Confetti emojis */}
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎉🏆🎉</div>
              <div className="hd-victory-title">{t('hackerDefense:victory.title')}</div>
              <div className="hd-subtitle" style={{ marginBottom: 16 }}>
                {t('hackerDefense:victory.subtitle')}
              </div>

              {/* Final stats */}
              <div
                style={{
                  background: 'rgba(255,220,0,0.06)',
                  border: '1px solid rgba(255,220,0,0.2)',
                  borderRadius: 14,
                  padding: '14px 20px',
                  marginBottom: 18,
                }}
              >
                <div className="hd-stat-row">
                  <span className="hd-stat-label">{t('hackerDefense:gameOver.finalScore')}</span>
                  <span className="hd-stat-value good" style={{ color: '#ffdd00' }}>
                    {state.score.toLocaleString()}
                  </span>
                </div>
                <div className="hd-stat-row">
                  <span className="hd-stat-label">{t('hackerDefense:gameOver.highScore')}</span>
                  <span className="hd-stat-value">{state.highScore.toLocaleString()}</span>
                </div>
              </div>

              {/* Unlocked Pets */}
              {state.unlockedPets.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                    {t('hackerDefense:victory.petsUnlocked')}
                  </div>
                  <div className="hd-pets-row">
                    {state.unlockedPets.map((pet) => (
                      <div key={pet} className="hd-pet-badge">
                        {pet === 'privacy-dog' ? '🐕' : pet === 'happy-lock' ? '🔓' : '🛡️'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => dispatch({ type: 'RESTART' })}
                className="hd-btn hd-btn-primary"
                style={{ width: '100%', fontSize: 14 }}
              >
                {t('hackerDefense:victory.playAgain')}
              </button>
            </div>
          </div>
        )}

        {/* GAME OVER */}
        {state.phase === 'GAME_OVER' && (
          <GameOverScreen state={state} onRestart={() => dispatch({ type: 'RESTART' })} />
        )}
      </div>
    </div>
  );
}

// ── Scale hook ─────────────────────────────────────────────────────────────
function useScaleToFit(targetW: number, targetH: number): [number] {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function update() {
      const sw = window.innerWidth / targetW;
      const sh = window.innerHeight / targetH;
      setScale(Math.min(sw, sh));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [targetW, targetH]);

  return [scale];
}
