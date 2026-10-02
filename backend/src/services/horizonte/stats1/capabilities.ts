export const STATS1_CAPABILITIES = {
  'stats.dot-plot.v2': ['visual.dot-plot.v1', 'operation.drag-point.v1', 'operation.move-menu.v1', 'operation.show-table.v1'],
  'stats.balance-point.v2': ['visual.balance-point.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'stats.normal.v2': ['visual.normal-curve.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'stats.binomial.v2': ['visual.binomial-bars.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'stats.clt.v2': ['visual.sampling-mean.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
} as const;
