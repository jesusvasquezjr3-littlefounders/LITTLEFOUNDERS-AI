export const SPACE2_CAPABILITIES = {
  'math.surface.v2': ['visual.surface.v1', 'operation.read-surface.v1', 'operation.slice-surface.v1'],
  'math.surface-formula.v2': ['visual.surface-formula.v1', 'operation.read-partials.v1', 'operation.walk-gradient.v1'],
  'geography.globe-route.v2': ['visual.globe-route.v1', 'operation.rotate-globe.v1', 'operation.compare-routes.v1'],
  'space.ar-table.v2': ['visual.ar-table.v1', 'operation.view-object.v1', 'operation.optional-ar.v1'],
} as const;
