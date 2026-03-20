import type { GameState, GameAction, Enemy, Tower, Projectile, Particle, DamageNumber, DataPacket, TowerSlot, LevelStats, TwoFAState, BossPopupState } from './types';
import {
  INITIAL_TOWER_SLOTS,
  ENEMY_DEFS,
  TOWER_DEFS,
  LEVEL_WAVES,
  INBOX_EMAILS,
  getPositionOnPath,
  PATH_DATA,
  GAME_CONFIG,
  UPGRADE_COSTS,
} from './constants';

// ─── Helpers ──────────────────────────────────────────────────────────────
let _idCounter = 0;
function uid(): string {
  return `${Date.now()}_${++_idCounter}`;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function findClosestEnemy(
  enemies: Enemy[],
  tx: number,
  ty: number,
  range: number,
  requireRevealed: boolean
): Enemy | null {
  let best: Enemy | null = null;
  let bestDist = Infinity;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    if (requireRevealed && e.type === 'phishing' && e.disguised && !e.revealed) continue;
    const d = dist(e.x, e.y, tx, ty);
    if (d <= range && d < bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best;
}

function createEnemy(type: Enemy['type']): Enemy {
  const def = ENEMY_DEFS[type];
  const startPos = getPositionOnPath(0);
  return {
    id: uid(),
    type,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    reward: def.reward,
    stolen: def.stolen,
    distanceTraveled: 0,
    x: startPos.x,
    y: startPos.y,
    disguised: type === 'phishing',
    revealed: type !== 'phishing',
    slowed: false,
    slowTimer: 0,
    hitFlash: 0,
    shieldBreak: false,
    size: def.size,
    emoji: def.emoji,
  };
}

function spawnParticles(x: number, y: number, count: number, emoji: string): Particle[] {
  return Array.from({ length: count }, () => ({
    id: uid(),
    x,
    y,
    emoji,
    vx: (Math.random() - 0.5) * 6,
    vy: (Math.random() - 1.5) * 5,
    life: 20 + Math.floor(Math.random() * 15),
    maxLife: 35,
    scale: 0.8 + Math.random() * 0.6,
  }));
}

function createDamageNumber(x: number, y: number, value: number, isCrit: boolean): DamageNumber {
  return { id: uid(), x, y, value, isCrit, life: 22 };
}

function emptyStats(bankBalance: number): LevelStats {
  return {
    phishingDetected: 0,
    phishingMissed: 0,
    inboxCorrect: false,
    twoFASuccess: 0,
    twoFAFailed: 0,
    bankBalanceStart: bankBalance,
    bankBalanceEnd: bankBalance,
    enemiesKilled: 0,
    bossPopupsClosed: 0,
  };
}

function generate2FACode(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

function generateBossPopup(): BossPopupState {
  return {
    id: uid(),
    closeX: 15 + Math.random() * 55,
    closeY: 15 + Math.random() * 55,
    life: GAME_CONFIG.bossPopupLife,
  };
}

// ─── Initial State ─────────────────────────────────────────────────────────
export function createInitialState(): GameState {
  const stored = localStorage.getItem(GAME_CONFIG.highScoreKey);
  const highScore = stored ? parseInt(stored, 10) : 0;
  return {
    phase: 'START',
    level: 1,
    wave: 0,
    bankBalance: GAME_CONFIG.initialBankBalance,
    maxBankBalance: GAME_CONFIG.initialBankBalance,
    dataPoints: GAME_CONFIG.initialDataPoints,
    score: 0,
    highScore,
    enemies: [],
    towers: [],
    slots: INITIAL_TOWER_SLOTS.map(s => ({ ...s })),
    projectiles: [],
    particles: [],
    damageNumbers: [],
    dataPackets: [],
    waveActive: false,
    spawnQueue: [],
    spawnTimer: 0,
    nextPacketSpawn: 60,
    interWaveCountdown: 0,
    waveIncomingCountdown: 0,
    selectedTowerType: null,
    twoFA: null,
    bossPopups: [],
    inboxEmail: null,
    inboxDecision: null,
    inboxBonus: 0,
    inboxTimer: GAME_CONFIG.inboxTimerTicks,
    upgradeMinigame: null,
    levelStats: emptyStats(GAME_CONFIG.initialBankBalance),
    previousPhase: null,
    actionCommandWindow: 0,
    lastActionCommandTick: -99,
    tutorialStep: 0,
    tickCount: 0,
    waveKillCount: 0,
    gameOverReason: null,
    unlockedPets: [],
    allLevelStats: [],
  };
}

// ─── Core TICK reducer helper ──────────────────────────────────────────────
function processTick(state: GameState): GameState {
  if (state.phase !== 'PLAYING') return state;

  let {
    enemies, towers, slots, projectiles, particles, damageNumbers, dataPackets,
    bankBalance, dataPoints, score, spawnQueue, spawnTimer, waveActive,
    interWaveCountdown, nextPacketSpawn, twoFA, bossPopups, levelStats,
    actionCommandWindow, tickCount, waveKillCount, unlockedPets, wave, level,
  } = state;

  tickCount = tickCount + 1;

  // ── Spawn Data Packets ─────────────────────────────────────────────────
  let newPackets: DataPacket[] = [...dataPackets];
  let newNextPacketSpawn = nextPacketSpawn - 1;
  if (newNextPacketSpawn <= 0) {
    newNextPacketSpawn = GAME_CONFIG.dataPacketSpawnInterval;
    // Spawn packet at random position in map area (not on path)
    const px = 80 + Math.random() * 700;
    const py = 90 + Math.random() * 320;
    newPackets.push({
      id: uid(),
      x: px,
      y: py,
      value: GAME_CONFIG.dataPacketValue,
      life: GAME_CONFIG.dataPacketLife,
    });
  }
  // Age packets
  newPackets = newPackets.map(p => ({ ...p, life: p.life - 1 })).filter(p => p.life > 0);

  // ── Wave Spawning ──────────────────────────────────────────────────────
  let newEnemies = [...enemies];
  let newSpawnQueue = [...spawnQueue];
  let newSpawnTimer = spawnTimer + 1;

  if (waveActive && newSpawnQueue.length > 0) {
    const nextSpawn = newSpawnQueue[0];
    if (newSpawnTimer >= nextSpawn.delayTicks) {
      newEnemies.push(createEnemy(nextSpawn.type));
      newSpawnQueue = newSpawnQueue.slice(1);
    }
  }

  // ── Move Enemies ──────────────────────────────────────────────────────
  let bankDamage = 0;
  let newDataPoints = dataPoints;
  let newScore = score;
  let newParticles = [...particles];
  let newDamageNumbers = [...damageNumbers];
  let newLevelStats = { ...levelStats };
  let newWaveKillCount = waveKillCount;
  let newUnlockedPets = [...unlockedPets];
  let newBossPopups = [...bossPopups];

  const survivingEnemies: Enemy[] = [];
  for (let e of newEnemies) {
    if (e.hp <= 0) {
      // Enemy died → give rewards
      newDataPoints += e.reward;
      newScore += e.reward * 10;
      newWaveKillCount++;
      newLevelStats = { ...newLevelStats, enemiesKilled: newLevelStats.enemiesKilled + 1 };
      if (e.type === 'phishing') {
        newLevelStats = { ...newLevelStats, phishingDetected: newLevelStats.phishingDetected + 1 };
      }
      // Death particles
      const particleEmoji = e.type === 'boss' ? '💥' : e.type === 'phishing' ? '🎭' : '💨';
      newParticles = [...newParticles, ...spawnParticles(e.x, e.y, e.type === 'boss' ? 8 : 4, particleEmoji)];
      // Unlock pets
      if (newLevelStats.enemiesKilled >= 30 && !newUnlockedPets.includes('privacy-dog')) {
        newUnlockedPets = [...newUnlockedPets, 'privacy-dog'];
      }
      continue;
    }

    // Movement
    const effectiveSpeed = e.slowed ? e.speed * 0.45 : e.speed;
    const newDist = e.distanceTraveled + effectiveSpeed;
    const newPos = getPositionOnPath(newDist);

    // Check if enemy reached end of path
    if (newDist >= PATH_DATA.totalLen) {
      bankDamage += e.stolen;
      if (e.type === 'phishing') {
        newLevelStats = { ...newLevelStats, phishingMissed: newLevelStats.phishingMissed + 1 };
      }
      newParticles = [...newParticles, ...spawnParticles(newPos.x, newPos.y, 3, '💸')];
      continue;
    }

    // Update slow timer
    const slowTimer = e.slowTimer > 0 ? e.slowTimer - 1 : 0;
    const slowed = slowTimer > 0;

    // Update hit flash
    const hitFlash = e.hitFlash > 0 ? e.hitFlash - 1 : 0;

    // Boss popup logic
    if (e.type === 'boss' && newBossPopups.length < 1) {
      if (Math.random() < GAME_CONFIG.bossPopupChance) {
        newBossPopups = [...newBossPopups, generateBossPopup()];
      }
    }

    survivingEnemies.push({
      ...e,
      distanceTraveled: newDist,
      x: newPos.x,
      y: newPos.y,
      slowed,
      slowTimer,
      hitFlash,
    });
  }
  newEnemies = survivingEnemies;

  // Age boss popups
  newBossPopups = newBossPopups.map(p => ({ ...p, life: p.life - 1 })).filter(p => p.life > 0);

  // Bank damage
  let newBankBalance = bankBalance - bankDamage;

  // ── Tower Attacks ──────────────────────────────────────────────────────
  let newProjectiles = [...projectiles];
  const newTowers = towers.map(tower => {
    const updatedTower = { ...tower };

    // Reduce cooldown
    if (updatedTower.attackCooldown > 0) {
      updatedTower.attackCooldown = updatedTower.attackCooldown - 1;
    }
    if (updatedTower.shootFlash > 0) {
      updatedTower.shootFlash = updatedTower.shootFlash - 1;
    }

    // 2FA wall: reduce HP when enemies are in range
    if (tower.type === 'wall_2fa') {
      const nearbyEnemies = newEnemies.filter(e => dist(e.x, e.y, tower.x, tower.y) <= (tower.range || 50));
      if (nearbyEnemies.length > 0) {
        const hpLoss = nearbyEnemies.length * 0.8;
        updatedTower.hp = Math.max(0, (updatedTower.hp ?? 0) - hpLoss);
        // Slow nearby enemies
        for (let i = 0; i < newEnemies.length; i++) {
          if (dist(newEnemies[i].x, newEnemies[i].y, tower.x, tower.y) <= (tower.range || 50)) {
            newEnemies[i] = { ...newEnemies[i], slowed: true, slowTimer: Math.max(newEnemies[i].slowTimer, 15) };
          }
        }
        // Trigger 2FA when HP is low
        if (!state.twoFA && (updatedTower.hp ?? 0) < (updatedTower.maxHp ?? 1) * 0.25 && (updatedTower.hp ?? 0) > 0) {
          if (!updatedTower.twoFATriggered) {
            updatedTower.twoFATriggered = true;
          }
        }
      }
      return updatedTower;
    }

    // Attack logic for other towers
    if (updatedTower.attackCooldown > 0) return updatedTower;

    // Find target (antivirus reveals phishing)
    const requireRevealed = tower.type !== 'antivirus';
    const target = findClosestEnemy(newEnemies, tower.x, tower.y, tower.range, requireRevealed);

    if (!target) {
      updatedTower.targetId = null;
      return updatedTower;
    }

    updatedTower.targetId = target.id;
    updatedTower.attackCooldown = updatedTower.attackCooldownMax;
    updatedTower.shootFlash = 5;

    // Create projectile
    newProjectiles.push({
      id: uid(),
      towerId: tower.id,
      targetId: target.id,
      x: tower.x,
      y: tower.y,
      targetX: target.x,
      targetY: target.y,
      damage: tower.damage,
      type: tower.type,
      speed: 22,
      lifespan: 12,
    });

    // Antivirus: reveal phishing enemies in range
    if (tower.type === 'antivirus') {
      for (let i = 0; i < newEnemies.length; i++) {
        if (newEnemies[i].type === 'phishing' && !newEnemies[i].revealed) {
          if (dist(newEnemies[i].x, newEnemies[i].y, tower.x, tower.y) <= tower.range) {
            newEnemies[i] = { ...newEnemies[i], revealed: true, disguised: false };
          }
        }
      }
    }

    return updatedTower;
  });

  // ── Move Projectiles & Apply Damage ───────────────────────────────────
  const survivingProjectiles: Projectile[] = [];
  for (const proj of newProjectiles) {
    const projLife = proj.lifespan - 1;
    if (projLife <= 0) continue;

    // Find current target position
    const targetEnemy = newEnemies.find(e => e.id === proj.targetId);

    if (!targetEnemy || targetEnemy.hp <= 0) {
      // Redirect to nearest enemy
      const redir = findClosestEnemy(newEnemies, proj.x, proj.y, 999, false);
      if (!redir) continue;

      const dx = redir.x - proj.x;
      const dy = redir.y - proj.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < proj.speed + 5) {
        // Hit!
        const dmg = proj.damage;
        const idx = newEnemies.findIndex(e => e.id === redir.id);
        if (idx !== -1) {
          newEnemies[idx] = { ...newEnemies[idx], hp: newEnemies[idx].hp - dmg, hitFlash: 4 };
          newDamageNumbers.push(createDamageNumber(redir.x, redir.y - 30, dmg, false));
          if (proj.type === 'antivirus') {
            newEnemies[idx] = { ...newEnemies[idx], slowed: true, slowTimer: 30 };
          }
        }
      } else {
        survivingProjectiles.push({ ...proj, lifespan: projLife, targetId: redir.id, targetX: redir.x, targetY: redir.y });
      }
      continue;
    }

    const txn = targetEnemy.x;
    const tyn = targetEnemy.y;
    const dx = txn - proj.x;
    const dy = tyn - proj.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < proj.speed + 5) {
      // Hit!
      const isCrit = state.actionCommandWindow > 0;
      const dmg = isCrit ? Math.floor(proj.damage * GAME_CONFIG.actionCommandMultiplier) : proj.damage;
      const idx = newEnemies.findIndex(e => e.id === proj.targetId);
      if (idx !== -1) {
        newEnemies[idx] = { ...newEnemies[idx], hp: newEnemies[idx].hp - dmg, hitFlash: 4 };
        newDamageNumbers.push(createDamageNumber(txn, tyn - 30, dmg, isCrit));
        if (proj.type === 'antivirus') {
          newEnemies[idx] = { ...newEnemies[idx], slowed: true, slowTimer: 30 };
        }
      }
    } else {
      const speed = proj.speed;
      const nx = proj.x + (dx / d) * speed;
      const ny = proj.y + (dy / d) * speed;
      survivingProjectiles.push({ ...proj, x: nx, y: ny, lifespan: projLife, targetX: txn, targetY: tyn });
    }
  }

  // ── Particles & Damage Numbers age ────────────────────────────────────
  const agedParticles = newParticles
    .map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.3,
      life: p.life - 1,
    }))
    .filter(p => p.life > 0);

  const agedDamageNumbers = newDamageNumbers
    .map(d => ({ ...d, y: d.y - 1.5, life: d.life - 1 }))
    .filter(d => d.life > 0);

  // ── 2FA Countdown ─────────────────────────────────────────────────────
  let newTwoFA = twoFA;
  if (newTwoFA) {
    newTwoFA = { ...newTwoFA, timeLeft: newTwoFA.timeLeft - 1 };
    if (newTwoFA.timeLeft <= 0) {
      // Timeout: fail
      newLevelStats = { ...newLevelStats, twoFAFailed: newLevelStats.twoFAFailed + 1 };
      newTwoFA = null;
      // Reset the wall's twoFATriggered flag
    }
  }

  // Check if any tower needs to trigger 2FA prompt
  if (!newTwoFA) {
    for (const t of newTowers) {
      if (t.type === 'wall_2fa' && t.twoFATriggered) {
        newTwoFA = {
          towerId: t.id,
          code: generate2FACode(),
          inputCode: '',
          timeLeft: GAME_CONFIG.twoFATimeoutTicks,
        };
        // Reset flag
        const tIdx = newTowers.findIndex(tt => tt.id === t.id);
        if (tIdx !== -1) newTowers[tIdx] = { ...newTowers[tIdx], twoFATriggered: false };
        break;
      }
    }
  }

  // ── Action Command window ──────────────────────────────────────────────
  let newACW = actionCommandWindow > 0 ? actionCommandWindow - 1 : 0;

  // ── Check wave complete ────────────────────────────────────────────────
  const waveComplete = waveActive && newSpawnQueue.length === 0 && newEnemies.length === 0;

  // ── Determine next phase ───────────────────────────────────────────────
  let nextPhase: GameState['phase'] = 'PLAYING';
  let nextInterWaveCountdown = interWaveCountdown;
  let nextWaveActive = waveActive;
  let nextWave = wave;

  if (newBankBalance <= 0) {
    newBankBalance = 0;
    nextPhase = 'GAME_OVER';
  } else if (waveComplete) {
    if (wave >= GAME_CONFIG.maxWave) {
      // Level complete
      nextPhase = 'LEVEL_RESULT';
      newLevelStats = { ...newLevelStats, bankBalanceEnd: newBankBalance };
      const stored = localStorage.getItem(GAME_CONFIG.highScoreKey);
      const prevHigh = stored ? parseInt(stored, 10) : 0;
      if (newScore > prevHigh) {
        localStorage.setItem(GAME_CONFIG.highScoreKey, String(newScore));
      }
    } else {
      // Inter-wave countdown
      if (interWaveCountdown <= 0) {
        const waveDef = LEVEL_WAVES[level - 1][wave - 1];
        nextInterWaveCountdown = waveDef.interWaveDelayTicks;
        nextWaveActive = false;
      }
      nextInterWaveCountdown = nextInterWaveCountdown - 1;
      if (nextInterWaveCountdown <= 0 && !nextWaveActive) {
        // Start next wave
        nextWave = wave + 1;
        nextWaveActive = true;
        nextInterWaveCountdown = 0;
      }
    }
  } else if (!waveActive && interWaveCountdown > 0) {
    nextInterWaveCountdown = interWaveCountdown - 1;
    if (nextInterWaveCountdown <= 0) {
      // Start next wave
      nextWave = wave + 1;
      nextWaveActive = true;
    }
  }

  // Load spawn queue for new wave
  let nextSpawnQueue = newSpawnQueue;
  let nextSpawnTimer = newSpawnTimer;
  if (nextWave !== wave && nextWave <= GAME_CONFIG.maxWave) {
    const waveDef = LEVEL_WAVES[level - 1][nextWave - 1];
    nextSpawnQueue = [...waveDef.spawns];
    nextSpawnTimer = 0;
  }

  return {
    ...state,
    phase: nextPhase,
    wave: nextWave,
    bankBalance: newBankBalance,
    dataPoints: newDataPoints,
    score: newScore,
    enemies: newEnemies,
    towers: newTowers,
    projectiles: survivingProjectiles,
    particles: agedParticles,
    damageNumbers: agedDamageNumbers,
    dataPackets: newPackets,
    waveActive: nextWaveActive,
    spawnQueue: nextSpawnQueue,
    spawnTimer: nextSpawnTimer,
    nextPacketSpawn: newNextPacketSpawn,
    interWaveCountdown: nextInterWaveCountdown,
    twoFA: newTwoFA,
    bossPopups: newBossPopups,
    levelStats: newLevelStats,
    actionCommandWindow: newACW,
    tickCount,
    waveKillCount: newWaveKillCount,
    unlockedPets: newUnlockedPets,
    gameOverReason: nextPhase === 'GAME_OVER' ? 'balance' : null,
  };
}

// ─── Main Reducer ──────────────────────────────────────────────────────────
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    case 'START_GAME':
      return { ...state, phase: 'TUTORIAL', tutorialStep: 0 };

    case 'TUTORIAL_NEXT': {
      const nextStep = state.tutorialStep + 1;
      if (nextStep >= 4) {
        // Go to inbox
        const email = INBOX_EMAILS[(state.level - 1) % INBOX_EMAILS.length];
        return {
          ...state,
          phase: 'INBOX',
          inboxEmail: email,
          inboxDecision: null,
          inboxTimer: GAME_CONFIG.inboxTimerTicks,
        };
      }
      return { ...state, tutorialStep: nextStep };
    }

    case 'SKIP_TUTORIAL': {
      const email = INBOX_EMAILS[(state.level - 1) % INBOX_EMAILS.length];
      return {
        ...state,
        phase: 'INBOX',
        inboxEmail: email,
        inboxDecision: null,
        inboxTimer: GAME_CONFIG.inboxTimerTicks,
      };
    }

    case 'INBOX_PREVIEW_DECIDE': {
      // Just record the decision, stay in INBOX phase to show feedback
      const email = state.inboxEmail;
      if (!email || state.inboxDecision !== null) return state;
      const correct = action.decision === (email.isPhishing ? 'phishing' : 'trust');
      const bonus = correct ? GAME_CONFIG.inboxBonus : 0;
      const newLevelStats = { ...state.levelStats, inboxCorrect: correct };
      return {
        ...state,
        inboxDecision: action.decision,
        inboxBonus: bonus,
        levelStats: newLevelStats,
      };
    }

    case 'INBOX_DECIDE': {
      // Actually start the game after inbox decision (called after preview)
      const email = state.inboxEmail;
      if (!email) return state;
      const waveDef = LEVEL_WAVES[state.level - 1][0];
      return {
        ...state,
        phase: 'PLAYING',
        dataPoints: state.dataPoints + state.inboxBonus,
        wave: 1,
        waveActive: true,
        spawnQueue: [...waveDef.spawns],
        spawnTimer: 0,
        interWaveCountdown: 0,
      };
    }

    case 'TICK':
      return processTick(state);

    case 'SELECT_TOWER_TYPE':
      return {
        ...state,
        selectedTowerType: state.selectedTowerType === action.towerType ? null : action.towerType,
      };

    case 'PLACE_TOWER': {
      if (state.phase !== 'PLAYING') return state;
      const selectedType = state.selectedTowerType;
      if (!selectedType) return state;
      const slot = state.slots.find(s => s.id === action.slotId);
      if (!slot || slot.occupied) return state;

      const cost = TOWER_DEFS[selectedType].cost;
      if (state.dataPoints < cost) return state;

      const levelDef = TOWER_DEFS[selectedType].levels[0];
      const newTower: Tower = {
        id: uid(),
        type: selectedType,
        level: 1,
        slotId: action.slotId,
        x: slot.x,
        y: slot.y,
        range: levelDef.range,
        damage: levelDef.damage,
        attackCooldownMax: levelDef.cooldownTicks,
        attackCooldown: 0,
        targetId: null,
        shootFlash: 0,
        ...(selectedType === 'wall_2fa' ? {
          hp: (levelDef as { hp: number; range: number; cooldownTicks: number; damage: number; label: string }).hp,
          maxHp: (levelDef as { hp: number; range: number; cooldownTicks: number; damage: number; label: string }).hp,
          twoFATriggered: false,
        } : {}),
      };

      const newSlots = state.slots.map(s =>
        s.id === action.slotId ? { ...s, occupied: true } : s
      );

      return {
        ...state,
        towers: [...state.towers, newTower],
        slots: newSlots,
        dataPoints: state.dataPoints - cost,
        selectedTowerType: null,
      };
    }

    case 'REQUEST_UPGRADE': {
      if (state.phase !== 'PLAYING') return state;
      const tower = state.towers.find(t => t.id === action.towerId);
      if (!tower || tower.level >= 3) return state;
      const cost = UPGRADE_COSTS[tower.level];
      if (state.dataPoints < cost) return state;

      // If password tower: require minigame
      if (tower.type === 'password') {
        return {
          ...state,
          upgradeMinigame: {
            towerId: action.towerId,
            targetLevel: tower.level + 1,
            selected: { upper: null, lower: null, number: null, symbol: null },
          },
          previousPhase: 'PLAYING',
          phase: 'UPGRADE_MINIGAME',
        };
      }

      // Other towers: direct upgrade
      return applyTowerUpgrade(state, action.towerId);
    }

    case 'CONFIRM_UPGRADE': {
      if (!state.upgradeMinigame) return state;
      const { upper, lower, number, symbol } = action.password;
      if (!upper || !lower || !number || !symbol) return state;
      const newState = applyTowerUpgrade(
        { ...state, phase: 'PLAYING', upgradeMinigame: null },
        state.upgradeMinigame.towerId
      );
      return newState;
    }

    case 'CANCEL_UPGRADE':
      return { ...state, phase: 'PLAYING', upgradeMinigame: null };

    case 'COLLECT_PACKET': {
      const packet = state.dataPackets.find(p => p.id === action.packetId);
      if (!packet) return state;
      return {
        ...state,
        dataPoints: state.dataPoints + packet.value,
        dataPackets: state.dataPackets.filter(p => p.id !== action.packetId),
        score: state.score + 50,
        particles: [...state.particles, ...spawnParticles(packet.x, packet.y, 3, '✨')],
      };
    }

    case 'ACTION_COMMAND':
      return {
        ...state,
        actionCommandWindow: GAME_CONFIG.actionCommandWindow,
        lastActionCommandTick: state.tickCount,
      };

    case 'TYPE_2FA': {
      if (!state.twoFA) return state;
      if (action.char === 'BACKSPACE') {
        const trimmed = state.twoFA.inputCode.slice(0, -1);
        return { ...state, twoFA: { ...state.twoFA, inputCode: trimmed } };
      }
      if (state.twoFA.inputCode.length >= 4) return state;
      const newInput = state.twoFA.inputCode + action.char;
      return { ...state, twoFA: { ...state.twoFA, inputCode: newInput } };
    }

    case 'SUBMIT_2FA': {
      if (!state.twoFA) return state;
      const success = state.twoFA.inputCode === state.twoFA.code;
      if (success) {
        // Restore wall HP, stun enemies
        const newTowers = state.towers.map(t => {
          if (t.id === state.twoFA!.towerId && t.type === 'wall_2fa') {
            return { ...t, hp: t.maxHp, twoFATriggered: false };
          }
          return t;
        });
        const stunRadius = 90;
        const wall = state.towers.find(t => t.id === state.twoFA!.towerId);
        const stunParticles = wall ? spawnParticles(wall.x, wall.y, 8, '🔒') : [];
        const newEnemies = state.enemies.map(e => {
          if (wall && dist(e.x, e.y, wall.x, wall.y) <= stunRadius) {
            return { ...e, slowed: true, slowTimer: 40, hitFlash: 8 };
          }
          return e;
        });
        return {
          ...state,
          twoFA: null,
          towers: newTowers,
          enemies: newEnemies,
          particles: [...state.particles, ...stunParticles],
          levelStats: { ...state.levelStats, twoFASuccess: state.levelStats.twoFASuccess + 1 },
        };
      } else {
        return {
          ...state,
          twoFA: null,
          levelStats: { ...state.levelStats, twoFAFailed: state.levelStats.twoFAFailed + 1 },
        };
      }
    }

    case 'CANCEL_2FA':
      return {
        ...state,
        twoFA: null,
        levelStats: { ...state.levelStats, twoFAFailed: state.levelStats.twoFAFailed + 1 },
      };

    case 'CLOSE_BOSS_POPUP': {
      const newPopups = state.bossPopups.filter(p => p.id !== action.popupId);
      const closed = state.bossPopups.length - newPopups.length;
      return {
        ...state,
        bossPopups: newPopups,
        score: state.score + closed * 100,
        levelStats: { ...state.levelStats, bossPopupsClosed: state.levelStats.bossPopupsClosed + closed },
      };
    }

    case 'MARK_PHISHING': {
      const newEnemies = state.enemies.map(e => {
        if (e.id === action.enemyId && e.type === 'phishing') {
          return { ...e, revealed: true, disguised: false };
        }
        return e;
      });
      return { ...state, enemies: newEnemies };
    }

    case 'NEXT_LEVEL': {
      const nextLevel = state.level + 1;
      if (nextLevel > GAME_CONFIG.maxLevel) {
        return { ...state, phase: 'VICTORY' };
      }
      const email = INBOX_EMAILS[(nextLevel - 1) % INBOX_EMAILS.length];
      const newAllLevelStats = [...state.allLevelStats, state.levelStats];
      return {
        ...state,
        phase: 'INBOX',
        level: nextLevel,
        wave: 0,
        bankBalance: state.bankBalance, // keep balance from previous level
        dataPoints: state.dataPoints + 200, // bonus data between levels
        enemies: [],
        towers: [],
        slots: INITIAL_TOWER_SLOTS.map(s => ({ ...s })),
        projectiles: [],
        particles: [],
        damageNumbers: [],
        dataPackets: [],
        waveActive: false,
        spawnQueue: [],
        spawnTimer: 0,
        twoFA: null,
        bossPopups: [],
        inboxEmail: email,
        inboxDecision: null,
        inboxTimer: GAME_CONFIG.inboxTimerTicks,
        levelStats: emptyStats(state.bankBalance),
        allLevelStats: newAllLevelStats,
        selectedTowerType: null,
      };
    }

    case 'PAUSE': {
      if (state.phase !== 'PLAYING') return state;
      return { ...state, phase: 'PAUSED', previousPhase: 'PLAYING' };
    }

    case 'RESUME': {
      if (state.phase !== 'PAUSED') return state;
      return { ...state, phase: 'PLAYING', previousPhase: null };
    }

    case 'RESTART':
      return createInitialState();

    default:
      return state;
  }
}

// ─── Helper: Apply tower upgrade ──────────────────────────────────────────
function applyTowerUpgrade(state: GameState, towerId: string): GameState {
  const tower = state.towers.find(t => t.id === towerId);
  if (!tower || tower.level >= 3) return state;
  const cost = UPGRADE_COSTS[tower.level];
  if (state.dataPoints < cost) return state;

  const newLevel = tower.level + 1;
  const levelDef = TOWER_DEFS[tower.type].levels[newLevel - 1];
  const newTowers = state.towers.map(t => {
    if (t.id === towerId) {
      return {
        ...t,
        level: newLevel,
        range: levelDef.range,
        damage: levelDef.damage,
        attackCooldownMax: levelDef.cooldownTicks,
        ...(t.type === 'wall_2fa' ? { hp: (levelDef as { hp?: number }).hp, maxHp: (levelDef as { hp?: number }).hp } : {}),
      };
    }
    return t;
  });

  // Unlock pet on upgrade
  const newPets = [...state.unlockedPets];
  if (newLevel >= 2 && !newPets.includes('happy-lock')) {
    newPets.push('happy-lock');
  }

  return {
    ...state,
    towers: newTowers,
    dataPoints: state.dataPoints - cost,
    unlockedPets: newPets,
  };
}
