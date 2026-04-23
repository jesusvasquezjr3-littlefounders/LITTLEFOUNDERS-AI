import type { PlacementItem, PlacementDimension, AdventureLevel, PlacementResponse } from '../types';
import type { PlacementResult } from '@/lib/guestProfile';
import { ALL_ITEMS } from '../bank/items';

// ─── Age → Adventure mapping ─────────────────────────────────────────────────

export function ageToAdventure(age: number): AdventureLevel {
  if (age <= 9) return 2;
  if (age <= 12) return 3;
  if (age <= 14) return 4;
  if (age <= 17) return 5;
  return 6;
}

// ─── Applicable dimensions by adventure ─────────────────────────────────────

export function getDimensions(adventure: AdventureLevel): PlacementDimension[] {
  if (adventure <= 2) return ['numeracy', 'saving', 'security'];
  return ['numeracy', 'saving', 'investing', 'security'];
}

// ─── Streak analysis ─────────────────────────────────────────────────────────

function getCurrentStreak(responses: PlacementResponse[]): { correct: number; incorrect: number } {
  let correct = 0;
  let incorrect = 0;
  for (let i = responses.length - 1; i >= 0; i--) {
    if (responses[i].correct) {
      if (incorrect > 0) break;
      correct++;
    } else {
      if (correct > 0) break;
      incorrect++;
    }
  }
  return { correct, incorrect };
}

// ─── Weighted score ──────────────────────────────────────────────────────────

function weightedScore(responses: PlacementResponse[]): number {
  if (responses.length === 0) return 0;
  let weightedCorrect = 0;
  let weightedTotal = 0;
  for (const r of responses) {
    const item = ALL_ITEMS.find(i => i.id === r.itemId);
    if (!item) continue;
    weightedTotal += item.difficulty;
    if (r.correct) weightedCorrect += item.difficulty;
  }
  return weightedTotal > 0 ? weightedCorrect / weightedTotal : 0;
}

// ─── Adaptive item selection ─────────────────────────────────────────────────

export function selectNextItem(
  servedIds: string[],
  responses: PlacementResponse[],
  baseAdventure: AdventureLevel,
): PlacementItem | null {
  const streak = getCurrentStreak(responses);

  // Probe one level up after 3 correct in a row
  const probeHigher = streak.correct >= 3 && baseAdventure < 6;
  const targetAdventure: AdventureLevel = probeHigher
    ? ((baseAdventure + 1) as AdventureLevel)
    : baseAdventure;

  // Difficulty window
  let diffMin = 2;
  let diffMax = 4;
  if (streak.correct >= 2) { diffMin = 3; diffMax = 5; }
  if (streak.incorrect >= 2) { diffMin = 1; diffMax = 3; }

  // Find the least-covered dimension
  const dims = getDimensions(baseAdventure);
  const dimCounts: Record<string, number> = Object.fromEntries(dims.map(d => [d, 0]));
  servedIds.forEach(id => {
    const item = ALL_ITEMS.find(i => i.id === id);
    if (item && dimCounts[item.dimension] !== undefined) dimCounts[item.dimension]++;
  });
  const targetDim = [...dims].sort((a, b) => dimCounts[a] - dimCounts[b])[0];

  // Candidate pool: preferred adventure + dimension + difficulty
  let pool = ALL_ITEMS.filter(item =>
    !servedIds.includes(item.id) &&
    item.adventure === targetAdventure &&
    item.difficulty >= diffMin &&
    item.difficulty <= diffMax &&
    item.dimension === targetDim,
  );

  // Widen: drop dimension constraint
  if (pool.length === 0) {
    pool = ALL_ITEMS.filter(item =>
      !servedIds.includes(item.id) &&
      item.adventure === targetAdventure &&
      item.difficulty >= diffMin &&
      item.difficulty <= diffMax,
    );
  }

  // Fall back to base adventure
  if (pool.length === 0) {
    pool = ALL_ITEMS.filter(item =>
      !servedIds.includes(item.id) &&
      item.adventure === baseAdventure,
    );
  }

  if (pool.length === 0) return null;

  // Prefer easiest when struggling; random otherwise
  if (streak.incorrect >= 2) {
    return pool.sort((a, b) => a.difficulty - b.difficulty)[0];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Stop condition ──────────────────────────────────────────────────────────

export function shouldStop(servedCount: number, responses: PlacementResponse[], maxItems = 12): boolean {
  if (servedCount >= maxItems) return true;
  if (servedCount < 8) return false;

  // Stable score: last-3 delta < 0.05
  if (responses.length >= 6) {
    const scoreFull = weightedScore(responses);
    const scorePrev = weightedScore(responses.slice(0, -3));
    if (Math.abs(scoreFull - scorePrev) < 0.05) return true;
  }
  return false;
}

// ─── Final placement decision ────────────────────────────────────────────────

export function computePlacementResult(
  responses: PlacementResponse[],
  servedIds: string[],
  baseAdventure: AdventureLevel,
  ageDeclared: number,
  startedAt: number,
): PlacementResult {
  const score = weightedScore(responses);
  const durationSec = Math.round((Date.now() - startedAt) / 1000);

  // Check performance on higher-adventure items
  const higherItems = responses.filter(r => {
    const item = ALL_ITEMS.find(i => i.id === r.itemId);
    return item && item.adventure > baseAdventure;
  });
  const higherRatio = higherItems.length > 0
    ? higherItems.filter(r => r.correct).length / higherItems.length
    : 0;

  // Advance to next adventure if high global performance OR strong on higher items
  let finalAdventure: AdventureLevel = baseAdventure;
  if (score >= 0.80 || (higherRatio >= 0.67 && higherItems.length >= 2)) {
    finalAdventure = Math.min(baseAdventure + 1, 6) as AdventureLevel;
  }

  // A6 with very low performance → drop to A5 (adult beginner)
  if (baseAdventure === 6 && score < 0.25) {
    finalAdventure = 5;
  }

  // Map score to saga within the final adventure
  let finalSaga: number;
  if (finalAdventure !== baseAdventure) {
    finalSaga = 1; // Start fresh in new adventure
  } else if (score < 0.25) {
    finalSaga = 1;
  } else if (score < 0.45) {
    finalSaga = 2;
  } else if (score < 0.65) {
    finalSaga = 3;
  } else if (score < 0.80) {
    finalSaga = 4;
  } else {
    finalSaga = 5;
  }

  finalSaga = Math.min(finalSaga, 5);

  return {
    version: 1,
    takenAt: new Date().toISOString(),
    durationSec,
    ageDeclared,
    baseAdventure,
    finalAdventure,
    finalSaga,
    targetLessonCode: `${finalAdventure}-${finalSaga}-1-1`,
    overallScore: score,
    confidence: Math.min(1, responses.length / 10),
    skipped: false,
    itemsServed: servedIds,
    itemsCorrect: responses.filter(r => r.correct).map(r => r.itemId),
  };
}
