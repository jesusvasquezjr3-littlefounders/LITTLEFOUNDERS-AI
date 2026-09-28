/*
 * The shared Pizarrón visuals (product B.7: one component set for lessons and
 * the Mentor's board). `PIZARRON_VISUALS` names every exported visual; the
 * whiteboard parity gate (agent/tools/check-instrument-parity.mjs) requires
 * every Oracle whiteboard kind to map to one of them.
 */
export {
  ArrayVisual, BalanceScaleVisual, BarModelVisual, BeadStringVisual, CIRCLE_DENOMINATORS, CoinGroupsVisual, DealVisual, FillContainerVisual,
  FractionCellsVisual, FractionCircleVisual, GrowthLinesVisual, IconArrayVisual, LedgerVisual, NumberLineVisual, PictographVisual, RatioLinesVisual,
  SERIES_TONES, SeriesBarsVisual, SortBinsVisual, TallyVisual, TapeKey, TenFrameVisual, TextCardsVisual, VennVisual, WaffleVisual, WorkedStepsVisual,
  WorkedStepsList, seriesTone,
} from './visuals';
export {
  AdditionDotsVisual, AllocationDonutVisual, AllocationStackVisual, AllocationWaffleVisual, BalanceMeterVisual, BaseTenVisual, ConditionRuleVisual,
  FunctionMachineVisual, GoalBulletVisual, GrowthCompareVisual, NumberAxisVisual, PercentGridVisual, SavingsLineVisual, StackedSlicesVisual,
} from './lessonVisuals';
export type { ComparePoint, LinePoint, PocketAmount, RuleCondition, StackSlice, WalletPocket } from './lessonVisuals';
export type {
  ChanceOutcome, CoinGroup, GrowthSeries, LedgerEntry, LineJump, LineMark, PictographRow, RatioGroup, RatioLine, RatioTick, SeriesBarRow, SeriesTone,
  SortBin, TallyRow, TapeRow, TapeSegment, TextCard, WaffleCategory, WorkedStep, WorkedStepRow,
} from './visuals';

export const PIZARRON_VISUALS = [
  'ArrayVisual', 'BalanceScaleVisual', 'BarModelVisual', 'BeadStringVisual', 'CoinGroupsVisual', 'DealVisual', 'FillContainerVisual',
  'FractionCellsVisual', 'FractionCircleVisual', 'GrowthLinesVisual', 'IconArrayVisual', 'LedgerVisual', 'NumberLineVisual', 'PictographVisual',
  'RatioLinesVisual', 'SeriesBarsVisual', 'SortBinsVisual', 'TallyVisual', 'TenFrameVisual', 'TextCardsVisual', 'VennVisual', 'WaffleVisual',
  'WorkedStepsVisual',
  // The lesson pictures (lessonVisuals.tsx): the same set, drawn beside the interactive layer of a lesson.
  'AdditionDotsVisual', 'AllocationDonutVisual', 'AllocationStackVisual', 'AllocationWaffleVisual', 'BalanceMeterVisual', 'BaseTenVisual',
  'ConditionRuleVisual', 'FunctionMachineVisual', 'GoalBulletVisual', 'GrowthCompareVisual', 'NumberAxisVisual', 'PercentGridVisual',
  'SavingsLineVisual', 'StackedSlicesVisual',
] as const;
export type PizarronVisualName = (typeof PIZARRON_VISUALS)[number];
