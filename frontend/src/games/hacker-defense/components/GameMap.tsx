import { useTranslation } from 'react-i18next';
import type { GameState, TowerType } from '../types';
import {
  PATH_WAYPOINTS,
  TOWER_DEFS,
  UPGRADE_COSTS,
  GAME_CONFIG,
  CANVAS_H,
  CANVAS_W,
  HUD_H,
  TOOLBAR_H,
} from '../constants';

interface Props {
  state: GameState;
  onPlaceTower: (slotId: number) => void;
  onMarkPhishing: (enemyId: string) => void;
  onCollectPacket: (packetId: string) => void;
  onCloseBossPopup: (id: string) => void;
  onRequestUpgrade: (towerId: string) => void;
}

// SVG path string from waypoints (adjusted for map coordinates: y offset by HUD_H)
function buildPathD(): string {
  const pts = PATH_WAYPOINTS.map(p => ({
    x: p.x,
    y: p.y - HUD_H,
  }));
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

const PATH_D = buildPathD();
const MAP_H = CANVAS_H - HUD_H - TOOLBAR_H;

function getEnemyHpColor(pct: number): string {
  if (pct > 0.6) return '#00e060';
  if (pct > 0.3) return '#ffb400';
  return '#ff3030';
}

function getTowerHpColor(pct: number): string {
  if (pct > 0.5) return '#c864ff';
  if (pct > 0.25) return '#ff8800';
  return '#ff3030';
}

export default function GameMap({
  state,
  onPlaceTower,
  onMarkPhishing,
  onCollectPacket,
  onCloseBossPopup,
  onRequestUpgrade,
}: Props) {
  const { t } = useTranslation('games');

  const { enemies, towers, slots, projectiles, particles, damageNumbers, dataPackets, selectedTowerType, bossPopups, interWaveCountdown, wave, waveActive } = state;

  const mapYOffset = HUD_H;

  // ── Render enemy ────────────────────────────────────────────────────
  function renderEnemy(enemy: typeof enemies[0]) {
    const isPhishing = enemy.type === 'phishing';
    const isDisguised = isPhishing && enemy.disguised && !enemy.revealed;
    const isBoss = enemy.type === 'boss';

    const hpPct = enemy.hp / enemy.maxHp;
    const hpColor = getEnemyHpColor(hpPct);
    const hpWidth = Math.max(0, enemy.size * 1.2 * hpPct);

    const bodyStyle: React.CSSProperties = {
      width: enemy.size,
      height: enemy.size,
      fontSize: enemy.size * 0.55,
      background: isBoss
        ? 'linear-gradient(135deg,#2a0a0a,#600000)'
        : enemy.type === 'ddos'
        ? 'linear-gradient(135deg,#1a0a3a,#3a0a6a)'
        : isDisguised
        ? 'linear-gradient(135deg,#1a2a1a,#2a4a2a)'
        : 'linear-gradient(135deg,#1a0a0a,#3a0808)',
      boxShadow: isBoss
        ? '0 0 20px rgba(255,0,0,0.5), 0 2px 8px rgba(0,0,0,0.7)'
        : '0 2px 8px rgba(0,0,0,0.5)',
    };

    return (
      <div
        key={enemy.id}
        className="hd-enemy"
        style={{ left: enemy.x, top: enemy.y - mapYOffset }}
        onClick={isPhishing && !enemy.revealed ? () => onMarkPhishing(enemy.id) : undefined}
        title={isPhishing && !enemy.revealed ? t('hackerDefense:enemy.phishingHint') : undefined}
      >
        {/* Phishing indicator (question mark when disguised) */}
        {isDisguised && (
          <div className="hd-phishing-indicator">❓</div>
        )}
        {/* Revealed phishing badge */}
        {isPhishing && enemy.revealed && (
          <div className="hd-revealed-badge">
            {t('hackerDefense:enemy.phishingRevealed')}
          </div>
        )}

        <div
          className={`hd-enemy-body ${enemy.hitFlash > 0 ? 'hit-flash' : ''} ${enemy.slowed ? 'slowed' : ''}`}
          style={bodyStyle}
        >
          <span className="hd-enemy-emoji">
            {isDisguised ? '📦' : enemy.emoji}
          </span>
          {/* Boss has shield crack overlay */}
          {isBoss && enemy.hp < enemy.maxHp * 0.5 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(255,0,0,0.2), transparent)',
                borderRadius: 'inherit',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        {/* HP bar */}
        <div
          className="hd-enemy-hp-bar"
          style={{ width: enemy.size * 1.2 }}
        >
          <div className="hd-enemy-hp-fill" style={{ width: hpWidth, background: hpColor }} />
        </div>

        {/* Slow effect overlay */}
        {enemy.slowed && (
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              fontSize: 10,
              animation: 'hd-float 0.8s ease-in-out infinite alternate',
            }}
          >
            🧊
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="hd-map"
      style={{ height: MAP_H }}
    >
      {/* SVG Path */}
      <svg
        className="hd-path-svg"
        viewBox={`0 0 ${CANVAS_W} ${MAP_H}`}
        preserveAspectRatio="none"
      >
        {/* Path glow (outer) */}
        <path
          d={PATH_D}
          fill="none"
          stroke="rgba(0,255,120,0.08)"
          strokeWidth={66}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Path base */}
        <path
          d={PATH_D}
          fill="none"
          stroke="#0d1f10"
          strokeWidth={58}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Path edge */}
        <path
          d={PATH_D}
          fill="none"
          stroke="rgba(0,180,80,0.25)"
          strokeWidth={62}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Path inner (walkable) */}
        <path
          d={PATH_D}
          fill="none"
          stroke="#0f2515"
          strokeWidth={52}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Path center line */}
        <path
          d={PATH_D}
          fill="none"
          stroke="rgba(0,255,120,0.12)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="8 12"
        />
        {/* Entry arrow indicators */}
        <text x={-28} y={410 - HUD_H + 5} fontSize={16} fill="rgba(255,80,80,0.6)" textAnchor="middle">▶▶</text>
        {/* Base icon at end */}
        <text x={930} y={260 - HUD_H + 8} fontSize={30} textAnchor="middle">🏦</text>
      </svg>

      {/* Inter-wave countdown banner */}
      {!waveActive && interWaveCountdown > 0 && (
        <div className="hd-countdown-banner">
          <span style={{ fontSize: 16 }}>⚔️</span>
          <span className="hd-countdown-text">
            {t('hackerDefense:map.nextWaveIn', { seconds: Math.ceil(interWaveCountdown / 20) })}
          </span>
        </div>
      )}

      {/* Build towers hint when between waves */}
      {!waveActive && interWaveCountdown > 0 && interWaveCountdown > 100 && (
        <div
          className="hd-build-hint"
          style={{ top: 115 }}
        >
          <span>🔧</span>
          <span>{t('hackerDefense:map.buildHint')}</span>
        </div>
      )}

      {/* Tower Slots */}
      {selectedTowerType && slots.map(slot => {
        if (slot.occupied) return null;
        const cost = TOWER_DEFS[selectedTowerType].cost;
        const canAfford = state.dataPoints >= cost;
        return (
          <div
            key={slot.id}
            className="hd-tower-slot"
            style={{
              left: slot.x,
              top: slot.y - mapYOffset,
              borderColor: canAfford ? 'rgba(0,255,120,0.5)' : 'rgba(255,68,68,0.4)',
              background: canAfford ? 'rgba(0,255,120,0.06)' : 'rgba(255,68,68,0.04)',
            }}
            onClick={() => onPlaceTower(slot.id)}
          >
            <span className="hd-slot-plus">{canAfford ? '+' : '✕'}</span>
          </div>
        );
      })}

      {/* Occupied slot indicators (hidden circles when no tower type selected) */}
      {!selectedTowerType && slots.map(slot => {
        if (slot.occupied) return null;
        return (
          <div
            key={slot.id}
            className="hd-tower-slot no-select"
            style={{ left: slot.x, top: slot.y - mapYOffset }}
          />
        );
      })}

      {/* Towers */}
      {towers.map(tower => {
        const def = TOWER_DEFS[tower.type];
        const levelDef = def.levels[tower.level - 1];
        const canUpgrade = tower.level < 3;
        const upgradeCost = canUpgrade ? UPGRADE_COSTS[tower.level] : 0;
        const canAffordUpgrade = state.dataPoints >= upgradeCost;

        return (
          <div
            key={tower.id}
            className="hd-tower"
            style={{ left: tower.x, top: tower.y - mapYOffset }}
            onClick={() => canUpgrade && onRequestUpgrade(tower.id)}
            title={canUpgrade ? `${t('hackerDefense:tower.upgrade')} (💾${upgradeCost})` : undefined}
          >
            {/* Range circle (visible on hover) */}
            <div
              className="hd-tower-range"
              style={{
                width: tower.range * 2,
                height: tower.range * 2,
                marginLeft: -tower.range,
                marginTop: -tower.range,
              }}
            />

            {/* Tower body */}
            <div
              className={`hd-tower-body ${tower.type} ${tower.shootFlash > 0 ? 'shoot-flash' : ''}`}
            >
              <span style={{ fontSize: 22 }}>{def.emoji}</span>

              {/* Level badge */}
              <div className="hd-tower-level-badge">L{tower.level}</div>
            </div>

            {/* 2FA HP bar */}
            {tower.type === 'wall_2fa' && tower.maxHp && (
              <div className="hd-tower-hp-bar">
                <div
                  className="hd-tower-hp-fill"
                  style={{
                    width: `${((tower.hp ?? 0) / tower.maxHp) * 100}%`,
                    background: getTowerHpColor((tower.hp ?? 0) / tower.maxHp),
                  }}
                />
              </div>
            )}

            {/* Upgrade hint badge (shows when can afford) */}
            {canUpgrade && canAffordUpgrade && (
              <div className="hd-upgrade-badge">▲ Lv{tower.level + 1}</div>
            )}

            {/* Shoot flash effect */}
            {tower.shootFlash > 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: -4,
                  borderRadius: 16,
                  border: `3px solid ${tower.type === 'password' ? '#64a0ff' : tower.type === 'antivirus' ? '#00ff78' : '#c864ff'}`,
                  animation: 'hd-ac-pulse 0.2s ease-out forwards',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        );
      })}

      {/* Enemies */}
      {enemies.map(renderEnemy)}

      {/* Projectiles */}
      {projectiles.map(proj => (
        <div
          key={proj.id}
          className="hd-projectile"
          style={{
            left: proj.x,
            top: proj.y - mapYOffset,
            fontSize: proj.type === 'password' ? 12 : 14,
          }}
        >
          {proj.type === 'password' ? '✳️' : proj.type === 'antivirus' ? '🔎' : '🔒'}
        </div>
      ))}

      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="hd-particle"
          style={{
            left: p.x,
            top: p.y - mapYOffset,
            fontSize: 14 * p.scale,
            opacity: p.life / p.maxLife,
          }}
        >
          {p.emoji}
        </div>
      ))}

      {/* Floating damage numbers */}
      {damageNumbers.map(dn => (
        <div
          key={dn.id}
          className={`hd-damage-num ${dn.isCrit ? 'crit' : 'normal'}`}
          style={{
            left: dn.x,
            top: dn.y - mapYOffset,
            opacity: dn.life / 22,
          }}
        >
          {dn.isCrit && '⚡'}
          {dn.value}
        </div>
      ))}

      {/* Data Packets */}
      {dataPackets.map(packet => (
        <div
          key={packet.id}
          className={`hd-data-packet ${packet.life < 30 ? 'fading' : ''}`}
          style={{ left: packet.x, top: packet.y - mapYOffset }}
          onClick={() => onCollectPacket(packet.id)}
          title={`+${packet.value} 💾`}
        >
          💾
          <div
            style={{
              position: 'absolute',
              bottom: -12,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 9,
              color: '#64a0ff',
              fontWeight: 700,
              fontFamily: 'Orbitron, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            +{packet.value}
          </div>
        </div>
      ))}

      {/* Boss Popups */}
      {bossPopups.map(popup => {
        const POPUP_VARIANTS = [
          { icon: '🏆', titleKey: 'hackerDefense:bossPopup.title1', bodyKey: 'hackerDefense:bossPopup.body1' },
          { icon: '💰', titleKey: 'hackerDefense:bossPopup.title2', bodyKey: 'hackerDefense:bossPopup.body2' },
          { icon: '🔔', titleKey: 'hackerDefense:bossPopup.title3', bodyKey: 'hackerDefense:bossPopup.body3' },
        ];
        const variant = POPUP_VARIANTS[bossPopups.indexOf(popup) % POPUP_VARIANTS.length];
        const timerPct = (popup.life / GAME_CONFIG.bossPopupLife) * 100;

        return (
          <div
            key={popup.id}
            className="hd-boss-popup"
            style={{
              left: `${popup.closeX}%`,
              top: `${popup.closeY}%`,
              transform: 'translate(-10%, -10%)',
            }}
          >
            <button
              className="hd-boss-popup-close"
              onClick={() => onCloseBossPopup(popup.id)}
            >
              ×
            </button>
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: 3,
                width: timerPct + '%',
                background: '#ffc800',
                borderRadius: '0 0 0 10px',
                transition: 'width 0.1s linear',
              }}
            />
            <div className="hd-boss-popup-title">
              {variant.icon} {t(variant.titleKey)}
            </div>
            <div className="hd-boss-popup-body">{t(variant.bodyKey)}</div>
            <div
              style={{
                textAlign: 'center',
                padding: '6px',
                background: 'rgba(255,200,0,0.15)',
                borderRadius: 8,
                color: '#c84800',
                fontWeight: 900,
                fontSize: 11,
                cursor: 'pointer',
                border: '1px solid rgba(255,200,0,0.3)',
              }}
              onClick={() => onCloseBossPopup(popup.id)}
            >
              ❌ {t('hackerDefense:bossPopup.doNotClick')}
            </div>
          </div>
        );
      })}

      {/* Action Command Flash Effect */}
      {state.actionCommandWindow > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, rgba(255,220,0,0.06) 0%, transparent 60%)',
            zIndex: 7,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 18,
              fontWeight: 900,
              color: '#ffdd00',
              textShadow: '0 0 20px rgba(255,220,0,0.8)',
              letterSpacing: 3,
              animation: 'hd-damage-rise 0.4s ease-out forwards',
            }}
          >
            ⚡ CRITICAL ⚡
          </div>
        </div>
      )}
    </div>
  );
}
