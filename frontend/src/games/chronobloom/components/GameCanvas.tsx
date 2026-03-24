import { useRef, useEffect } from 'react';
import type { GameState, Plant, Enemy, PlantType } from '../types';
import {
  CANVAS_W, CANVAS_H, MAP_Y, MAP_H, GREENHOUSE_W,
  CELL_W, CELL_H, GRID_COLS, GRID_ROWS, PLANT_DEFS, ENEMY_DEFS,
  getCellCenter,
} from '../constants';

interface Props {
  state: GameState;
  hoveredCell: { col: number; row: number } | null;
  onClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave: () => void;
}

// ─── Color helpers ────────────────────────────────────────────────────────────
function lerpColor(a: string, b: string, t: number) {
  const parse = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const ca = parse(a), cb = parse(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function plantEmoji(type: PlantType): string {
  const map: Record<PlantType, string> = {
    savings_sprout: '🌱',
    stock_tree: '🌳',
    div_vine: '🌿',
    emergency_cactus: '🌵',
  };
  return map[type];
}

function enemyEmoji(type: string): string {
  const map: Record<string, string> = {
    ant_expense: '🐜',
    impulsive_beast: '👹',
    inflation_zeppelin: '🎈',
    deficit_king: '👑',
  };
  return map[type] || '❓';
}

export default function GameCanvas({ state, hoveredCell, onClick, onMouseMove, onMouseLeave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const hoveredRef = useRef(hoveredCell);
  stateRef.current = state;
  hoveredRef.current = hoveredCell;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    let lastT = 0;

    function draw(t: number) {
      rafId = requestAnimationFrame(draw);
      if (t - lastT < 16) return; // ~60 fps cap
      lastT = t;
      const s = stateRef.current;
      const hovered = hoveredRef.current;
      ctx!.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawBackground(ctx!, s, hovered, t);
      drawGreenhouse(ctx!, s, t);
      drawGrid(ctx!, s, hovered);
      drawPlants(ctx!, s, t);
      drawEnemies(ctx!, s, t);
      drawProjectiles(ctx!, s, t);
      drawCapitalDrops(ctx!, s, t);
      drawParticles(ctx!, s, t);
      drawFloatingNumbers(ctx!, s, t);
      drawInflationGas(ctx!, s, t);
    }

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="cb-canvas"
      width={CANVAS_W}
      height={CANVAS_H}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    />
  );
}

// ─── Background ───────────────────────────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D, s: GameState, hovered: {col:number;row:number}|null, t: number) {
  // Map background
  const grad = ctx.createLinearGradient(0, MAP_Y, 0, MAP_Y + MAP_H);
  grad.addColorStop(0, '#0d2b18');
  grad.addColorStop(1, '#091a0d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, MAP_Y, CANVAS_W, MAP_H);

  // Subtle radial glows for ambiance
  const pulse = 0.5 + 0.5 * Math.sin(t / 1800);
  const radGrad = ctx.createRadialGradient(450, MAP_Y + MAP_H / 2, 0, 450, MAP_Y + MAP_H / 2, 400);
  radGrad.addColorStop(0, `rgba(74,222,128,${0.02 + 0.01 * pulse})`);
  radGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, MAP_Y, CANVAS_W, MAP_H);
}

// ─── Greenhouse (left strip) ──────────────────────────────────────────────────
function drawGreenhouse(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const x = 0, y = MAP_Y, w = GREENHOUSE_W, h = MAP_H;
  const hpPct = s.greenhouseHp / s.maxGreenhouseHp;

  // Building base
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  const col = hpPct > 0.5 ? '#1c4a28' : hpPct > 0.25 ? '#4a3218' : '#4a1818';
  grad.addColorStop(0, col);
  grad.addColorStop(1, '#0b1e0e');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Right border
  ctx.strokeStyle = hpPct > 0.5
    ? 'rgba(74,222,128,0.5)'
    : hpPct > 0.25
    ? 'rgba(251,146,60,0.6)'
    : 'rgba(239,68,68,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();

  // Windows (glass panels)
  for (let row = 0; row < GRID_ROWS; row++) {
    const wy = MAP_Y + row * CELL_H + 12;
    const wh = CELL_H - 24;
    const pulse = Math.sin(t / 1200 + row * 0.8) * 0.15 + 0.15;
    const glassColor = hpPct > 0.5 ? `rgba(74,222,128,${pulse})` : `rgba(239,68,68,${pulse})`;
    ctx.fillStyle = glassColor;
    ctx.strokeStyle = hpPct > 0.5 ? 'rgba(74,222,128,0.4)' : 'rgba(239,68,68,0.4)';
    ctx.lineWidth = 1;
    roundRect(ctx, x + 10, wy, 30, wh, 4);
    ctx.fill();
    ctx.stroke();

    // Window cross
    ctx.strokeStyle = hpPct > 0.5 ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + 25, wy);
    ctx.lineTo(x + 25, wy + wh);
    ctx.moveTo(x + 10, wy + wh / 2);
    ctx.lineTo(x + 40, wy + wh / 2);
    ctx.stroke();
  }

  // HP bar
  const barH = 6;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x + 6, y + h - 14, w - 12, barH);
  const barColor = hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#fb923c' : '#ef4444';
  ctx.fillStyle = barColor;
  ctx.fillRect(x + 6, y + h - 14, Math.max(0, (w - 12) * hpPct), barH);

  // Label
  ctx.fillStyle = 'rgba(134,239,172,0.7)';
  ctx.font = '7px "Orbitron", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GH', x + w / 2, y + h - 20);
  ctx.textAlign = 'left';
}

// ─── Grid ──────────────────────────────────────────────────────────────────────
function drawGrid(ctx: CanvasRenderingContext2D, s: GameState, hovered: {col:number;row:number}|null) {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const x = GREENHOUSE_W + col * CELL_W;
      const y = MAP_Y + row * CELL_H;

      const isOccupied = s.plants.some(p => p.col === col && p.row === row);
      const isHovered = hovered?.col === col && hovered?.row === row;
      const isSelected = s.selectedPlantId
        ? s.plants.some(p => p.id === s.selectedPlantId && p.col === col && p.row === row)
        : false;

      // Checkerboard
      const even = (row + col) % 2 === 0;
      ctx.fillStyle = even ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.02)';
      ctx.fillRect(x, y, CELL_W, CELL_H);

      // Hover highlight
      if (isHovered && !isOccupied && s.selectedPlantType && s.phase === 'PLANNING') {
        const canAfford = s.capital >= Math.floor(PLANT_DEFS[s.selectedPlantType].cost * s.inflationMultiplier);
        ctx.fillStyle = canAfford ? 'rgba(74,222,128,0.18)' : 'rgba(239,68,68,0.18)';
        ctx.fillRect(x, y, CELL_W, CELL_H);
      }

      // Selected plant cell
      if (isSelected) {
        ctx.fillStyle = 'rgba(255,215,0,0.15)';
        ctx.fillRect(x, y, CELL_W, CELL_H);
      }

      // Occupied indicator (light soil patch under plant)
      if (isOccupied) {
        ctx.fillStyle = 'rgba(61,43,31,0.5)';
        ctx.beginPath();
        ctx.ellipse(x + CELL_W / 2, y + CELL_H - 10, 22, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Grid lines
      ctx.strokeStyle = 'rgba(74,222,128,0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, CELL_W, CELL_H);
    }
  }
}

// ─── Plants ────────────────────────────────────────────────────────────────────
function drawPlants(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  for (const plant of s.plants) {
    const { cx, cy } = getCellCenter(plant.col, plant.row);
    const def = PLANT_DEFS[plant.type];
    const isSelected = s.selectedPlantId === plant.id;

    // Bob animation
    const bob = Math.sin(t / 600 + plant.col * 0.5 + plant.row * 0.9) * 2.5;
    const px = cx;
    const py = cy + bob;

    // Shield visual (div_vine)
    if (plant.shieldHp > 0) {
      ctx.strokeStyle = 'rgba(52,211,153,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, def.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Frozen overlay
    if (plant.frozenTicks > 0) {
      ctx.fillStyle = 'rgba(147,197,253,0.3)';
      ctx.beginPath();
      ctx.arc(px, py, def.radius + 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glow
    const isLevelUp = plant.levelUpFlash > 0;
    const isGolden = plant.isGolden;
    const glowColor = isGolden ? '#ffd700' : isLevelUp ? '#ffd700' : def.glowColor;
    const glowAlpha = plant.hitFlash > 0 ? 0 : isGolden ? 0.7 : isLevelUp ? 0.6 : 0.4;

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isGolden ? 20 : isLevelUp ? 18 : 10;

    // Body
    const bodyGrad = ctx.createRadialGradient(px - 4, py - 6, 2, px, py, def.radius);
    bodyGrad.addColorStop(0, isGolden ? '#ffd700' : def.color);
    bodyGrad.addColorStop(1, isGolden ? '#b45309' : def.glowColor + 'aa');
    ctx.fillStyle = plant.hitFlash > 0 ? '#ffffff' : bodyGrad;
    ctx.beginPath();
    ctx.arc(px, py, def.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Emoji
    ctx.font = `${def.radius * 1.1}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(plantEmoji(plant.type), px, py - 2);

    // Selected ring
    if (isSelected) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(px, py, def.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // HP bar
    const hpPct = plant.hp / plant.maxHp;
    const bw = 46, bh = 5;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, px - bw / 2, py + def.radius + 4, bw, bh, 2);
    ctx.fill();
    const hpColor = hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#fb923c' : '#ef4444';
    ctx.fillStyle = hpColor;
    roundRect(ctx, px - bw / 2, py + def.radius + 4, Math.max(1, bw * hpPct), bh, 2);
    ctx.fill();

    // Capital value tag
    const valStr = `$${plant.capitalValue}`;
    ctx.font = '8px "Orbitron", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = isGolden ? '#ffd700' : '#4ade80';
    ctx.fillText(valStr, px, py + def.radius + 17);

    // Interest rate tag
    if (plant.type !== 'emergency_cactus') {
      const rateStr = `+${Math.floor(plant.interestRate * 100)}%/yr`;
      ctx.font = '7px "Nunito", sans-serif';
      ctx.fillStyle = 'rgba(134,239,172,0.6)';
      ctx.fillText(rateStr, px, py + def.radius + 27);
    }

    // Frozen snowflake
    if (plant.frozenTicks > 0) {
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❄️', px + def.radius - 4, py - def.radius + 4);
    }

    // HODL golden crown
    if (isGolden) {
      ctx.font = '12px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', px, py - def.radius - 6);
    }

    ctx.textBaseline = 'alphabetic';
  }
}

// ─── Enemies ──────────────────────────────────────────────────────────────────
function drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  for (const enemy of s.enemies) {
    const def = ENEMY_DEFS[enemy.type];
    const wobble = Math.sin(t / 250 + enemy.wobble) * 3;
    const ex = enemy.x;
    const ey = enemy.y + (enemy.isAerial ? wobble * 0.8 : wobble * 0.3);
    const r = def.size / 2;

    // Zeppelin gas cloud
    if (enemy.type === 'inflation_zeppelin') {
      const gasAlpha = 0.08 + 0.04 * Math.sin(t / 400);
      ctx.fillStyle = `rgba(245,158,11,${gasAlpha})`;
      ctx.beginPath();
      ctx.ellipse(ex, ey + 20, r * 2.5, r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(ex, enemy.isAerial ? ey + r + 25 : ey + r + 5, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.shadowColor = enemy.hitFlash > 0 ? '#ffffff' : def.color;
    ctx.shadowBlur = enemy.hitFlash > 0 ? 20 : 8;

    // Body gradient
    const bodyGrad = ctx.createRadialGradient(ex - r * 0.3, ey - r * 0.3, r * 0.1, ex, ey, r);
    const baseColor = enemy.hitFlash > 0 ? '#ffffff' : def.color;
    bodyGrad.addColorStop(0, baseColor);
    bodyGrad.addColorStop(1, def.color + '88');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Emoji
    ctx.font = `${r * 1.2}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(enemyEmoji(enemy.type), ex, ey - 1);

    // Frozen ice
    if (enemy.frozenTicks > 0) {
      ctx.fillStyle = 'rgba(147,197,253,0.35)';
      ctx.beginPath();
      ctx.arc(ex, ey, r + 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // HP bar
    const hpPct = enemy.hp / enemy.maxHp;
    const bw = r * 2.2, bh = 5;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, ex - bw / 2, ey - r - 11, bw, bh, 2);
    ctx.fill();
    const hpColor = hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#fb923c' : '#ef4444';
    ctx.fillStyle = hpColor;
    roundRect(ctx, ex - bw / 2, ey - r - 11, Math.max(1, bw * hpPct), bh, 2);
    ctx.fill();

    // Deficit King: danger aura
    if (enemy.type === 'deficit_king') {
      const auraAlpha = 0.15 + 0.1 * Math.sin(t / 300);
      ctx.strokeStyle = `rgba(124,58,237,${auraAlpha * 3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, r + 8 + Math.sin(t / 200) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.textBaseline = 'alphabetic';
  }
}

// ─── Projectiles ──────────────────────────────────────────────────────────────
function drawProjectiles(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  for (const proj of s.projectiles) {
    if (proj.isAoe) continue;

    // Coin projectile
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Coin glint
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(proj.x - 1.5, proj.y - 1.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Capital Drops ────────────────────────────────────────────────────────────
function drawCapitalDrops(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  for (const drop of s.capitalDrops) {
    const alpha = Math.min(1, drop.life / 40);
    const bob = Math.sin(t / 500 + drop.x * 0.1) * 3;

    // "Do a Barrel Roll" easter egg: coin spins as it waits
    ctx.save();
    ctx.translate(drop.x, drop.y + bob);
    ctx.rotate(drop.spin);

    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.globalAlpha = alpha;
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪙', 0, 0);
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 1;
    ctx.restore();

    // Value label
    ctx.font = '8px "Orbitron", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = `rgba(255,215,0,${alpha})`;
    ctx.fillText(`+${drop.value}`, drop.x, drop.y + bob + 16);
  }
}

// ─── Particles ────────────────────────────────────────────────────────────────
function drawParticles(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  for (const p of s.particles) {
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    if (p.spin !== undefined) ctx.rotate(p.spin);
    ctx.scale(p.scale * alpha * 0.5 + p.scale * 0.5, p.scale * alpha * 0.5 + p.scale * 0.5);
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.emoji, 0, 0);
    ctx.restore();
  }
}

// ─── Floating Numbers ─────────────────────────────────────────────────────────
function drawFloatingNumbers(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  for (const fn of s.floatingNumbers) {
    const alpha = fn.life / fn.maxLife;
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 13px "Orbitron", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = fn.color;
    ctx.shadowColor = fn.color;
    ctx.shadowBlur = 6;
    ctx.fillText(fn.value, fn.x, fn.y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

// ─── Inflation Gas ────────────────────────────────────────────────────────────
function drawInflationGas(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  if (s.inflationMultiplier <= 1) return;
  const zeps = s.enemies.filter(e => e.type === 'inflation_zeppelin');
  for (const zep of zeps) {
    const gasAlpha = 0.04 + 0.02 * Math.sin(t / 600);
    const gradR = ctx.createRadialGradient(zep.x, zep.y, 0, zep.x, zep.y, 120);
    gradR.addColorStop(0, `rgba(245,158,11,${gasAlpha * 4})`);
    gradR.addColorStop(1, 'transparent');
    ctx.fillStyle = gradR;
    ctx.fillRect(Math.max(GREENHOUSE_W, zep.x - 130), MAP_Y, 260, MAP_H);
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
