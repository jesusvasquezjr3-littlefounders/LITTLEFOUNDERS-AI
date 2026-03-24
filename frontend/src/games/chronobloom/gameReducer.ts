import type {
  GameState, GameAction, Plant, Enemy, Projectile, Particle,
  CapitalDrop, FloatingNumber, YearStats, YearResultData, EnemySpawn, EnemyType
} from './types';
import {
  PLANT_DEFS, ENEMY_DEFS, LEVEL_WAVES, GAME_CONFIG, getCellCenter,
  CANVAS_W, MAP_Y, CELL_H, CELL_W, GREENHOUSE_W,
  getEnemyHpMultiplier
} from './constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _eid = 0;
const uid = () => `e${++_eid}_${Date.now()}`;

function makeInitialYearStats(level: number, year: number, capital: number): YearStats {
  return {
    year,
    level,
    capitalStart: capital,
    capitalEnd: capital,
    interestEarned: 0,
    plantsLost: 0,
    enemiesDefeated: 0,
    capitalStolenByEnemies: 0,
    bearMarketHit: false,
    ponziDeclined: false,
  };
}

function createEnemy(type: EnemyType, row: number, level: number, year: number): Enemy {
  const def = ENEMY_DEFS[type];
  const hpMult = getEnemyHpMultiplier(level, year);
  const rowY = MAP_Y + row * CELL_H + CELL_H / 2;
  const yOffset = def.isAerial ? -22 : 0;

  return {
    id: uid(),
    type,
    hp: Math.floor(def.hp * hpMult),
    maxHp: Math.floor(def.hp * hpMult),
    speed: def.speed,
    x: CANVAS_W + def.size + 10,
    y: rowY + yOffset,
    row,
    reward: def.reward,
    capitalSteal: def.capitalSteal,
    targetPlantId: null,
    attackDamage: def.attackDamage,
    attackCooldown: 0,
    attackCooldownMax: def.attackCooldownMax,
    hitFlash: 0,
    isAerial: def.isAerial,
    frozenTicks: 0,
    wobble: Math.random() * Math.PI * 2,
  };
}

function spawnCoinParticles(x: number, y: number, count = 4): Particle[] {
  return Array.from({ length: count }, () => ({
    id: uid(),
    x,
    y,
    emoji: '🪙',
    vx: (Math.random() - 0.5) * 4,
    vy: -(Math.random() * 3 + 1),
    life: 28,
    maxLife: 28,
    scale: 0.7 + Math.random() * 0.5,
    spin: 0,
    spinSpeed: (Math.random() - 0.5) * 0.3,
  }));
}

function spawnLeafParticles(x: number, y: number): Particle[] {
  return Array.from({ length: 5 }, () => ({
    id: uid(),
    x,
    y,
    emoji: ['🍃', '🌿', '🍀'][Math.floor(Math.random() * 3)],
    vx: (Math.random() - 0.5) * 3,
    vy: -(Math.random() * 2 + 0.5),
    life: 35,
    maxLife: 35,
    scale: 0.6 + Math.random() * 0.6,
    spin: 0,
    spinSpeed: (Math.random() - 0.5) * 0.2,
  }));
}

function spawnKillParticles(x: number, y: number): Particle[] {
  return Array.from({ length: 6 }, () => ({
    id: uid(),
    x,
    y,
    emoji: ['💥', '✨', '🪙'][Math.floor(Math.random() * 3)],
    vx: (Math.random() - 0.5) * 5,
    vy: -(Math.random() * 4 + 1),
    life: 22,
    maxLife: 22,
    scale: 0.8 + Math.random() * 0.6,
  }));
}

function makeFloatNum(x: number, y: number, value: string, color: string): FloatingNumber {
  return {
    id: uid(),
    x: x + (Math.random() - 0.5) * 20,
    y,
    value,
    color,
    life: 32,
    maxLife: 32,
  };
}

// ─── Initial State ────────────────────────────────────────────────────────────
export function createInitialState(): GameState {
  const hs = Number(localStorage.getItem(GAME_CONFIG.highScoreKey) || '0');
  return {
    phase: 'START',
    level: 1,
    year: 1,
    capital: GAME_CONFIG.initialCapital,
    greenhouseHp: GAME_CONFIG.initialGreenhouseHp,
    maxGreenhouseHp: GAME_CONFIG.initialGreenhouseHp,
    plants: [],
    enemies: [],
    projectiles: [],
    particles: [],
    capitalDrops: [],
    floatingNumbers: [],
    selectedPlantType: null,
    selectedPlantId: null,
    inflationMultiplier: 1,
    ponziVisible: false,
    ponziDeclined: false,
    waveActive: false,
    spawnQueue: [],
    spawnTimer: 0,
    score: 0,
    highScore: hs,
    yearStats: makeInitialYearStats(1, 1, GAME_CONFIG.initialCapital),
    allStats: [],
    tutorialStep: 0,
    tickCount: 0,
    previousPhase: null,
    gameOverReason: null,
    yearResultData: null,
    liquidatedEarly: 0,
    plantsMatureHarvested: 0,
  };
}

// ─── Tick Helpers ─────────────────────────────────────────────────────────────

function tickSpawn(state: GameState): GameState {
  if (!state.waveActive || state.spawnQueue.length === 0) return state;
  const newTimer = state.spawnTimer + 1;
  const newQueue = [...state.spawnQueue];
  const newEnemies = [...state.enemies];

  while (newQueue.length > 0 && newQueue[0].delayTicks <= newTimer) {
    const spawn = newQueue.shift()!;
    newEnemies.push(createEnemy(spawn.type, spawn.row, state.level, state.year));
  }

  return { ...state, spawnTimer: newTimer, spawnQueue: newQueue, enemies: newEnemies };
}

function tickEnemies(state: GameState): GameState {
  let newCapital = state.capital;
  let newGreenhouseHp = state.greenhouseHp;
  const newEnemies: Enemy[] = [];
  const newParticles = [...state.particles];
  const newFloating = [...state.floatingNumbers];
  let newPlants = state.plants.map(p => ({ ...p }));
  let newDrops = [...state.capitalDrops];
  let newStats = { ...state.yearStats };

  for (const enemy of state.enemies) {
    let e = { ...enemy };

    if (e.hitFlash > 0) e.hitFlash--;
    if (e.frozenTicks > 0) {
      e.frozenTicks--;
      newEnemies.push(e);
      continue;
    }

    // If targeting a plant
    if (e.targetPlantId) {
      const plantIdx = newPlants.findIndex(p => p.id === e.targetPlantId);
      if (plantIdx < 0 || newPlants[plantIdx].hp <= 0) {
        e.targetPlantId = null;
      } else {
        const plant = newPlants[plantIdx];
        if (e.attackCooldown <= 0 && e.attackDamage > 0) {
          e.attackCooldown = e.attackCooldownMax;
          // Impulsive beast: freeze before eating
          if (e.type === 'impulsive_beast' && plant.frozenTicks <= 0) {
            newPlants[plantIdx] = { ...plant, frozenTicks: 70 };
          }
          let dmg = e.attackDamage;
          const p = { ...newPlants[plantIdx] };
          if (p.shieldHp > 0) {
            const absorbed = Math.min(p.shieldHp, dmg);
            p.shieldHp -= absorbed;
            dmg -= absorbed;
          }
          p.hp = Math.max(0, p.hp - dmg);
          p.hitFlash = 6;
          newPlants[plantIdx] = p;
          if (dmg > 0) {
            const { cx, cy } = getCellCenter(p.col, p.row);
            newFloating.push(makeFloatNum(cx, cy - 20, `-${dmg}`, '#ef4444'));
          }
        } else if (e.attackCooldown > 0) {
          e.attackCooldown--;
        }
        e.wobble += 0.15;
        newEnemies.push(e);
        continue;
      }
    }

    const def = ENEMY_DEFS[e.type];
    const newX = e.x - e.speed;
    e.wobble += 0.1;

    if (def.passThroughPlants) {
      // Ants pass through — steal any capital drops nearby
      newDrops = newDrops.filter(d => {
        if (Math.abs(d.x - e.x) < 40 && Math.abs(d.y - e.y) < 40) {
          newFloating.push(makeFloatNum(d.x, d.y - 15, `-${d.value}`, '#ef4444'));
          return false; // ant steals it
        }
        return true;
      });

      if (newX <= GREENHOUSE_W) {
        newGreenhouseHp = Math.max(0, newGreenhouseHp - e.capitalSteal);
        newStats.capitalStolenByEnemies += e.capitalSteal;
        newParticles.push(...spawnCoinParticles(GREENHOUSE_W + 10, e.y, 3));
        newFloating.push(makeFloatNum(GREENHOUSE_W + 20, e.y - 20, `-${e.capitalSteal}`, '#ef4444'));
        continue; // consumed
      }
      e.x = newX;
    } else {
      // Normal enemy: find plant in same row ahead
      const plantsInRow = newPlants.filter(p =>
        p.row === e.row &&
        p.hp > 0 &&
        !p.id.startsWith('_ponzi')
      );
      const blocking = plantsInRow.find(p => {
        const { cx } = getCellCenter(p.col, p.row);
        return cx < e.x && cx > newX - CELL_W * 0.6;
      });

      if (blocking) {
        const { cx } = getCellCenter(blocking.col, blocking.row);
        e.x = cx + def.size * 0.65;
        e.targetPlantId = blocking.id;
      } else if (newX <= GREENHOUSE_W) {
        newGreenhouseHp = Math.max(0, newGreenhouseHp - e.capitalSteal);
        newStats.capitalStolenByEnemies += e.capitalSteal;
        newParticles.push(...spawnCoinParticles(GREENHOUSE_W + 10, e.y, 3));
        newFloating.push(makeFloatNum(GREENHOUSE_W + 20, e.y - 20, `-${e.capitalSteal}`, '#ef4444'));
        continue;
      } else {
        e.x = newX;
      }
    }

    newEnemies.push(e);
  }

  // Remove dead plants
  const deadPlantCount = newPlants.filter(p => p.hp <= 0).length;
  newStats.plantsLost += deadPlantCount;
  newPlants = newPlants.filter(p => p.hp > 0);

  return {
    ...state,
    enemies: newEnemies,
    plants: newPlants,
    capital: newCapital,
    capitalDrops: newDrops,
    greenhouseHp: newGreenhouseHp,
    particles: newParticles,
    floatingNumbers: newFloating,
    yearStats: newStats,
  };
}

function tickPlants(state: GameState): GameState {
  if (!state.waveActive) return state;
  const newProjectiles: Projectile[] = [...state.projectiles];
  const newParticles = [...state.particles];

  const newPlants = state.plants.map(plant => {
    const p = { ...plant };
    if (p.attackCooldown > 0) p.attackCooldown--;
    if (p.frozenTicks > 0) p.frozenTicks--;
    if (p.hitFlash > 0) p.hitFlash--;
    if (p.levelUpFlash > 0) p.levelUpFlash--;

    if (p.frozenTicks > 0) return p;
    if (p.type === 'stock_tree' || p.type === 'div_vine') return p;

    const { cx, cy } = getCellCenter(p.col, p.row);

    // Emergency cactus: fires AoE when enemies first come within range
    if (p.type === 'emergency_cactus') {
      if (p.attackCooldown > 0) return p; // already decremented above
      const hasEnemiesNear = state.enemies.some(e => {
        const dx = e.x - cx;
        const dy = e.y - cy;
        return Math.sqrt(dx * dx + dy * dy) <= p.range + 50; // slightly wider detection
      });
      if (hasEnemiesNear) {
        p.attackCooldown = p.attackCooldownMax;
        newProjectiles.push({
          id: uid(),
          plantId: p.id,
          targetId: 'AOE',
          x: cx,
          y: cy,
          targetX: cx,
          targetY: cy,
          damage: p.damage,
          type: 'emergency_cactus',
          speed: 0,
          isAoe: true,
          aoeRadius: p.range,
        });
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          newParticles.push({
            id: uid(),
            x: cx,
            y: cy,
            emoji: '🌵',
            vx: Math.cos(angle) * 3.5,
            vy: Math.sin(angle) * 3.5,
            life: 20,
            maxLife: 20,
            scale: 0.8,
          });
        }
      }
      return p;
    }

    if (p.damage === 0 || p.attackCooldown > 0) return p;

    // savings_sprout: shoot at nearest enemy in same row approaching from right
    // Includes aerial enemies (zeppelin) — coins can fly upward
    const rowEnemies = state.enemies.filter(e =>
      e.row === p.row && e.x > cx
    );
    if (rowEnemies.length === 0) return p;
    // Target the enemy closest to the plant (smallest x among those to the right)
    const nearest = rowEnemies.reduce((a, b) => a.x < b.x ? a : b);
    const dist = nearest.x - cx;
    if (dist > p.range) return p;

    p.attackCooldown = p.attackCooldownMax;
    newProjectiles.push({
      id: uid(),
      plantId: p.id,
      targetId: nearest.id,
      x: cx + 10,
      y: cy,
      targetX: nearest.x,
      targetY: nearest.y,
      damage: p.damage,
      type: p.type,
      speed: 7,
      isAoe: false,
      aoeRadius: 0,
    });
    // coin shoot particle
    newParticles.push({
      id: uid(),
      x: cx + 15,
      y: cy,
      emoji: '🪙',
      vx: 0.8,
      vy: -0.3,
      life: 5,
      maxLife: 5,
      scale: 0.5,
    });
    return p;
  });

  return { ...state, plants: newPlants, projectiles: newProjectiles, particles: newParticles };
}

function tickProjectiles(state: GameState): GameState {
  const remaining: Projectile[] = [];
  let newEnemies = state.enemies.map(e => ({ ...e }));
  let newCapital = state.capital;
  const newParticles = [...state.particles];
  const newFloating = [...state.floatingNumbers];
  let newStats = { ...state.yearStats };
  let newScore = state.score;

  for (const proj of state.projectiles) {
    const p = { ...proj };
    const targetIdx = newEnemies.findIndex(e => e.id === p.targetId);
    if (targetIdx < 0) continue; // target gone

    const target = newEnemies[targetIdx];
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= p.speed + 2) {
      // Hit!
      newEnemies[targetIdx] = {
        ...target,
        hp: target.hp - p.damage,
        hitFlash: 6,
      };
      newFloating.push(makeFloatNum(target.x, target.y - 22, String(p.damage), '#fbbf24'));

      if (newEnemies[targetIdx].hp <= 0) {
        newParticles.push(...spawnKillParticles(target.x, target.y));
        newCapital += target.reward;
        newScore += target.reward;
        newStats.enemiesDefeated++;
        newFloating.push(makeFloatNum(target.x, target.y - 38, `+${target.reward}`, '#ffd700'));
        newEnemies.splice(targetIdx, 1);
      }
    } else {
      p.x += (dx / dist) * p.speed;
      p.y += (dy / dist) * p.speed;
      remaining.push(p);
    }
  }

  return {
    ...state,
    projectiles: remaining,
    enemies: newEnemies,
    capital: newCapital,
    particles: newParticles,
    floatingNumbers: newFloating,
    yearStats: newStats,
    score: newScore,
  };
}

function tickParticles(state: GameState): GameState {
  const newParticles = state.particles
    .map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.12,
      life: p.life - 1,
      spin: (p.spin ?? 0) + (p.spinSpeed ?? 0),
    }))
    .filter(p => p.life > 0);

  return { ...state, particles: newParticles };
}

function tickDrops(state: GameState): GameState {
  // Organic drop generation from plants
  const newDrops: CapitalDrop[] = state.capitalDrops
    .map(d => ({ ...d, life: d.life - 1, spin: d.spin + 0.08 }))
    .filter(d => d.life > 0);

  // Generate drops from investment plants periodically
  if (state.tickCount % GAME_CONFIG.capitalDropInterval === 0 && state.waveActive) {
    for (const plant of state.plants) {
      if (plant.type === 'stock_tree' || plant.type === 'div_vine') {
        const { cx, cy } = getCellCenter(plant.col, plant.row);
        newDrops.push({
          id: uid(),
          x: cx + (Math.random() - 0.5) * 25,
          y: cy + 15,
          value: GAME_CONFIG.capitalDropValue,
          life: GAME_CONFIG.capitalDropLife,
          spin: 0,
        });
      }
    }
  }

  return { ...state, capitalDrops: newDrops };
}

function tickFloatingNumbers(state: GameState): GameState {
  const updated = state.floatingNumbers
    .map(fn => ({ ...fn, y: fn.y - 1.1, life: fn.life - 1 }))
    .filter(fn => fn.life > 0);
  return { ...state, floatingNumbers: updated };
}

// ─── Year End ────────────────────────────────────────────────────────────────
function handleYearEnd(state: GameState): GameState {
  const { level, year } = state;

  // Bear market?
  const bearChance =
    level === 1 ? GAME_CONFIG.bearMarketChanceL1 :
    level === 2 ? GAME_CONFIG.bearMarketChanceL2 :
    GAME_CONFIG.bearMarketChanceL3;
  const bearMarket = Math.random() < bearChance;

  // Apply vine buffs
  const vinePlants = state.plants.filter(p => p.type === 'div_vine' && p.hp > 0);
  const boostedPlantIds = new Set<string>();
  for (const vine of vinePlants) {
    const adjacent = state.plants.filter(
      p => p.id !== vine.id && p.hp > 0 &&
      Math.abs(p.col - vine.col) <= 1 &&
      Math.abs(p.row - vine.row) <= 1
    );
    const uniqueTypes = new Set(adjacent.map(p => p.type));
    if (uniqueTypes.size >= 2) {
      adjacent.forEach(p => boostedPlantIds.add(p.id));
    }
  }

  let totalInterest = 0;
  const breakdown: YearResultData['interestBreakdown'] = [];
  const particles: Particle[] = [...state.particles];

  const newPlants: Plant[] = [];

  for (const plant of state.plants) {
    const p = { ...plant };

    if (p.type === 'emergency_cactus') {
      breakdown.push({
        plantId: p.id, plantType: p.type,
        oldValue: p.capitalValue, newValue: 0,
        interestEarned: 0, bearMarket: false,
        disappeared: true, isGolden: false,
      });
      continue; // cactus disappears
    }

    p.yearsAlive++;
    const oldValue = p.capitalValue;
    let rate = p.interestRate;

    // Vine boost
    if (boostedPlantIds.has(p.id)) {
      rate += rate * GAME_CONFIG.vineBonusInterest;
    }

    // Bear market on stock trees
    let hadBear = false;
    if (p.type === 'stock_tree' && bearMarket) {
      p.capitalValue = Math.floor(p.capitalValue * (1 - GAME_CONFIG.bearMarketLoss));
      hadBear = true;
    }

    const interest = Math.floor(p.capitalValue * rate);
    p.capitalValue += interest;
    totalInterest += interest;

    // HP recovery between years
    p.hp = Math.min(p.maxHp, p.hp + 25);
    p.shieldHp = p.type === 'div_vine' ? GAME_CONFIG.vineShieldHp : 0;
    p.levelUpFlash = 80;

    // HODL easter egg
    if (p.yearsAlive >= 10) p.isGolden = true;

    const { cx, cy } = getCellCenter(p.col, p.row);
    particles.push(...spawnLeafParticles(cx, cy));
    if (interest > 0) particles.push(...spawnCoinParticles(cx, cy - 15, 3));

    breakdown.push({
      plantId: p.id, plantType: p.type,
      oldValue, newValue: p.capitalValue,
      interestEarned: interest,
      bearMarket: hadBear,
      disappeared: false,
      isGolden: p.isGolden,
    });

    newPlants.push(p);
  }

  const capitalAfter = state.capital + totalInterest;
  const isLevelComplete = year >= GAME_CONFIG.maxYear;

  const yearStats: YearStats = {
    ...state.yearStats,
    capitalEnd: capitalAfter,
    interestEarned: totalInterest,
    bearMarketHit: bearMarket,
  };

  const allStats = [
    ...state.allStats.slice(0, level - 1),
    [...(state.allStats[level - 1] || []), yearStats],
    ...state.allStats.slice(level),
  ];

  return {
    ...state,
    phase: isLevelComplete ? 'LEVEL_COMPLETE' : 'YEAR_RESULT',
    plants: newPlants,
    enemies: [],
    projectiles: [],
    particles,
    capitalDrops: [],
    floatingNumbers: [],
    capital: capitalAfter,
    waveActive: false,
    spawnTimer: 0,
    spawnQueue: [],
    inflationMultiplier: 1,
    yearStats,
    allStats,
    yearResultData: {
      interestBreakdown: breakdown,
      totalInterestEarned: totalInterest,
      bearMarketOccurred: bearMarket,
      capitalAfter,
      capitalBefore: state.capital,
    },
  };
}


function processAoeProjectiles(state: GameState): GameState {
  const aoes = state.projectiles.filter(p => p.isAoe && p.targetId === 'AOE');
  if (aoes.length === 0) return state;

  let newEnemies = [...state.enemies];
  let newCapital = state.capital;
  let newScore = state.score;
  const newParticles = [...state.particles];
  const newFloating = [...state.floatingNumbers];
  let newStats = { ...state.yearStats };

  for (const aoe of aoes) {
    const hitEnemies = newEnemies.filter(e => {
      const dx = e.x - aoe.x;
      const dy = e.y - aoe.y;
      return Math.sqrt(dx * dx + dy * dy) <= aoe.aoeRadius;
    });

    for (const he of hitEnemies) {
      const idx = newEnemies.findIndex(e => e.id === he.id);
      if (idx < 0) continue;
      newEnemies[idx] = { ...newEnemies[idx], hp: newEnemies[idx].hp - aoe.damage, hitFlash: 8 };
      newFloating.push(makeFloatNum(he.x, he.y - 22, String(aoe.damage), '#fb923c'));
      if (newEnemies[idx].hp <= 0) {
        newParticles.push(...spawnKillParticles(he.x, he.y));
        newCapital += he.reward;
        newScore += he.reward;
        newStats.enemiesDefeated++;
        newEnemies.splice(idx, 1);
      }
    }
  }

  const nonAoe = state.projectiles.filter(p => !(p.isAoe && p.targetId === 'AOE'));

  return {
    ...state,
    projectiles: nonAoe,
    enemies: newEnemies,
    capital: newCapital,
    particles: newParticles,
    floatingNumbers: newFloating,
    yearStats: newStats,
    score: newScore,
  };
}

// ─── Main Reducer ─────────────────────────────────────────────────────────────
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    case 'START_GAME':
      return { ...state, phase: 'TUTORIAL', tutorialStep: 0 };

    case 'TUTORIAL_NEXT': {
      const next = state.tutorialStep + 1;
      if (next >= 4) {
        return {
          ...state,
          phase: 'PLANNING',
          tutorialStep: 0,
          yearStats: makeInitialYearStats(state.level, state.year, state.capital),
        };
      }
      return { ...state, tutorialStep: next };
    }

    case 'SKIP_TUTORIAL':
      return {
        ...state,
        phase: 'PLANNING',
        tutorialStep: 0,
        yearStats: makeInitialYearStats(state.level, state.year, state.capital),
      };

    case 'SELECT_PLANT_TYPE':
      return {
        ...state,
        selectedPlantType: action.plantType,
        selectedPlantId: null,
      };

    case 'PLACE_PLANT': {
      if (state.phase !== 'PLANNING' || !state.selectedPlantType) return state;
      const def = PLANT_DEFS[state.selectedPlantType];
      const cost = Math.floor(def.cost * state.inflationMultiplier);
      if (state.capital < cost) return state;

      // Check cell occupied
      const occupied = state.plants.some(p => p.col === action.col && p.row === action.row);
      if (occupied) return state;

      const { cx, cy } = getCellCenter(action.col, action.row);
      const newPlant: Plant = {
        id: uid(),
        type: state.selectedPlantType,
        col: action.col,
        row: action.row,
        hp: def.hp,
        maxHp: def.hp,
        capitalValue: def.cost, // base value (before inflation adjusted cost)
        baseCapital: def.cost,
        yearsAlive: 0,
        isGolden: false,
        damage: def.damage,
        range: def.range,
        attackCooldown: 0,
        attackCooldownMax: def.attackCooldownMax,
        interestRate: def.interestRate,
        shieldHp: state.selectedPlantType === 'div_vine' ? GAME_CONFIG.vineShieldHp : 0,
        frozenTicks: 0,
        hitFlash: 0,
        levelUpFlash: 0,
      };

      const particles = [
        ...state.particles,
        ...spawnLeafParticles(cx, cy),
      ];

      return {
        ...state,
        plants: [...state.plants, newPlant],
        capital: state.capital - cost,
        particles,
      };
    }

    case 'SELECT_PLANT':
      return {
        ...state,
        selectedPlantId: action.plantId,
        selectedPlantType: null,
      };

    case 'LIQUIDATE_PLANT': {
      if (state.phase !== 'PLANNING') return state;
      const plant = state.plants.find(p => p.id === action.plantId);
      if (!plant) return state;

      const returnValue = plant.capitalValue;
      const wasMature = plant.yearsAlive >= 5;
      const { cx, cy } = getCellCenter(plant.col, plant.row);

      const particles = [
        ...state.particles,
        ...spawnCoinParticles(cx, cy, 5),
      ];
      const floating = [
        ...state.floatingNumbers,
        makeFloatNum(cx, cy - 25, `+${returnValue}`, '#ffd700'),
      ];

      return {
        ...state,
        plants: state.plants.filter(p => p.id !== action.plantId),
        capital: state.capital + returnValue,
        selectedPlantId: null,
        particles,
        floatingNumbers: floating,
        liquidatedEarly: wasMature ? state.liquidatedEarly : state.liquidatedEarly + 1,
        plantsMatureHarvested: wasMature ? state.plantsMatureHarvested + 1 : state.plantsMatureHarvested,
      };
    }

    case 'ADVANCE_YEAR': {
      if (state.phase !== 'PLANNING') return state;
      const waveIdx = state.year - 1;
      const waveDef = LEVEL_WAVES[state.level - 1]?.[waveIdx];
      if (!waveDef) return state;

      const sortedSpawns: EnemySpawn[] = [...waveDef.spawns].sort(
        (a, b) => a.delayTicks - b.delayTicks
      );

      // Ponzi easter egg: 15% chance on year 2+
      const showPonzi = state.year >= 2 && !state.ponziDeclined && Math.random() < 0.15;

      // Reset emergency cactus cooldowns so they can fire this wave
      const plantsReady = state.plants.map(p =>
        p.type === 'emergency_cactus' ? { ...p, attackCooldown: 0 } : p
      );

      const s: GameState = {
        ...state,
        phase: 'PLAYING',
        waveActive: true,
        spawnQueue: sortedSpawns,
        spawnTimer: 0,
        enemies: [],
        projectiles: [],
        particles: [],
        capitalDrops: [],
        floatingNumbers: [],
        selectedPlantType: null,
        selectedPlantId: null,
        ponziVisible: showPonzi,
        plants: plantsReady,
        yearStats: makeInitialYearStats(state.level, state.year, state.capital),
      };

      return s;
    }

    case 'COLLECT_DROP': {
      const drop = state.capitalDrops.find(d => d.id === action.dropId);
      if (!drop) return state;
      // "Do a Barrel Roll" easter egg: coin spins 360 before adding
      const floating = [
        ...state.floatingNumbers,
        makeFloatNum(drop.x, drop.y - 15, `+${drop.value}`, '#ffd700'),
      ];
      return {
        ...state,
        capitalDrops: state.capitalDrops.filter(d => d.id !== action.dropId),
        capital: state.capital + drop.value,
        floatingNumbers: floating,
      };
    }

    case 'UNFREEZE_PLANT': {
      const plant = state.plants.find(p => p.id === action.plantId);
      if (!plant || plant.frozenTicks <= 0) return state;
      if (state.capital < GAME_CONFIG.unfreezeMinCost) return state;
      return {
        ...state,
        capital: state.capital - GAME_CONFIG.unfreezeMinCost,
        plants: state.plants.map(p =>
          p.id === action.plantId ? { ...p, frozenTicks: 0 } : p
        ),
      };
    }

    case 'DECLINE_PONZI':
      return {
        ...state,
        ponziVisible: false,
        ponziDeclined: true,
        yearStats: { ...state.yearStats, ponziDeclined: true },
      };

    case 'ACCEPT_PONZI': {
      // The "magic seed" explodes — player loses capital, learns lesson
      const cost = GAME_CONFIG.ponziCapitalCost;
      const newCap = Math.max(0, state.capital - cost);
      const particles = [
        ...state.particles,
        ...Array.from({ length: 8 }, () => ({
          id: uid(),
          x: CANVAS_W / 2,
          y: 300,
          emoji: '💸',
          vx: (Math.random() - 0.5) * 6,
          vy: -(Math.random() * 5 + 1),
          life: 30,
          maxLife: 30,
          scale: 1.2,
        })),
      ];
      return {
        ...state,
        ponziVisible: false,
        ponziDeclined: true,
        capital: newCap,
        particles,
        floatingNumbers: [
          ...state.floatingNumbers,
          makeFloatNum(CANVAS_W / 2, 260, `-${cost} 💸`, '#ef4444'),
        ],
      };
    }

    case 'ACKNOWLEDGE_YEAR_RESULT': {
      if (state.phase !== 'YEAR_RESULT') return state;
      const nextYear = state.year + 1;
      return {
        ...state,
        phase: 'PLANNING',
        year: nextYear,
        yearResultData: null,
        particles: [],
      };
    }

    case 'NEXT_LEVEL': {
      if (state.phase !== 'LEVEL_COMPLETE') return state;
      const nextLevel = state.level + 1;
      if (nextLevel > GAME_CONFIG.maxLevel) {
        return { ...state, phase: 'VICTORY' };
      }
      // Save score
      const newScore = state.score + Math.floor(state.capital / 2);
      if (newScore > state.highScore) {
        localStorage.setItem(GAME_CONFIG.highScoreKey, String(newScore));
      }
      return {
        ...state,
        phase: 'PLANNING',
        level: nextLevel,
        year: 1,
        // Keep plants! They persist across levels (strategic continuity)
        capital: state.capital + GAME_CONFIG.levelBonusCapital,
        greenhouseHp: Math.min(state.maxGreenhouseHp, state.greenhouseHp + 300),
        yearResultData: null,
        particles: [],
        enemies: [],
        projectiles: [],
        capitalDrops: [],
        floatingNumbers: [],
        waveActive: false,
        score: newScore,
        inflationMultiplier: 1,
      };
    }

    case 'TICK': {
      if (state.phase !== 'PLAYING') return state;
      let s = { ...state, tickCount: state.tickCount + 1 };

      s = tickSpawn(s);
      s = tickEnemies(s);
      s = tickPlants(s);
      s = processAoeProjectiles(s);
      s = tickProjectiles(s);
      s = tickParticles(s);
      s = tickDrops(s);
      s = tickFloatingNumbers(s);

      // Inflation update
      const zepCount = s.enemies.filter(e => e.type === 'inflation_zeppelin').length;
      s.inflationMultiplier = 1 + zepCount * GAME_CONFIG.inflationPerZeppelin;

      // Wave complete?
      if (s.waveActive && s.spawnQueue.length === 0 && s.enemies.length === 0) {
        s = handleYearEnd(s);
      }

      // Game over?
      if (s.greenhouseHp <= 0) {
        const finalScore = s.score;
        if (finalScore > s.highScore) {
          localStorage.setItem(GAME_CONFIG.highScoreKey, String(finalScore));
        }
        s = { ...s, phase: 'GAME_OVER', gameOverReason: 'greenhouse' };
      }

      return s;
    }

    case 'PAUSE': {
      if (state.phase === 'PLAYING') {
        return { ...state, phase: 'PAUSED', previousPhase: 'PLAYING' };
      }
      return state;
    }

    case 'RESUME': {
      if (state.phase === 'PAUSED' && state.previousPhase) {
        return { ...state, phase: state.previousPhase, previousPhase: null };
      }
      return state;
    }

    case 'RESTART':
      return { ...createInitialState(), highScore: state.highScore };

    default:
      return state;
  }
}
