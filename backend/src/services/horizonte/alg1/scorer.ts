import type { HorizonteScorer } from '../types.js';
import { areaPieces, areaSlots, areaSolutionFits, areaTargets, readArea } from './area.js';
import { gradePlacement, homeResponse, INVALID, isRecord, payloadOf, type PlacementFrame } from './arrange.js';
import { cardPieces, cardSolutionFits, cardsConsistent, CARD_COMPARE, CARD_SLOTS, readCards } from './cards.js';
import { readTileCounts, tilePieces, tileSolutionFits, zeroBalanced, TILE_SLOTS } from './tiles.js';

function tilesFrame(segment: unknown): PlacementFrame | null {
  const payload = payloadOf(segment);
  const counts = isRecord(payload) ? readTileCounts(payload.counts) : null;
  return counts && {
    pieces: tilePieces(counts), slots: TILE_SLOTS, compare: TILE_SLOTS,
    consistent: (state) => zeroBalanced(state.zero ?? []), fits: (solution) => tileSolutionFits(solution, counts),
  };
}

function cardsFrame(segment: unknown): PlacementFrame | null {
  const cards = readCards(payloadOf(segment));
  return cards && {
    pieces: cardPieces(cards), slots: CARD_SLOTS, compare: CARD_COMPARE,
    consistent: (state) => cardsConsistent(state, cards), fits: (solution) => cardSolutionFits(solution, cards),
  };
}

function areaFrame(segment: unknown): PlacementFrame | null {
  const area = readArea(payloadOf(segment));
  return area && {
    pieces: areaPieces(area), slots: areaSlots(area), compare: areaTargets(area),
    consistent: (state) => areaTargets(area).every((slot) => (state[slot] ?? []).length <= 1), fits: (solution) => areaSolutionFits(solution, area),
  };
}

function scorer(frameOf: (segment: unknown) => PlacementFrame | null): HorizonteScorer {
  return {
    grade: ((segment: unknown, response: unknown, rubric: unknown) => {
      const frame = frameOf(segment);
      return frame ? gradePlacement(frame, response, rubric) : INVALID;
    }) as HorizonteScorer['grade'],
    sample: ((segment: unknown) => {
      const frame = frameOf(segment);
      return frame ? homeResponse(frame.pieces, frame.slots) : { slots: {} };
    }) as HorizonteScorer['sample'],
  };
}

export const ALG1_SCORERS: Readonly<Record<string, HorizonteScorer>> = {
  'math.algebra-tiles.v2': scorer(tilesFrame),
  'math.algebra-cards.v2': scorer(cardsFrame),
  'math.area-model.v2': scorer(areaFrame),
};
