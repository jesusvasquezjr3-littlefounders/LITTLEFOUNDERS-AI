export const GEOM2_CAPABILITIES = {
  'math.geoboard.v2': ['visual.geoboard.v1', 'operation.tap-pegs.v1'],
  'math.area-squares.v2': ['visual.area-squares.v1', 'operation.shade-cells.v1'],
  'math.transform.v2': ['visual.transform-plane.v1', 'visual.symmetry-mirror.v1', 'operation.drag-point.v1'],
  'math.tessellation.v2': ['visual.tessellation.v1', 'operation.place-tile.v1'],
} as const;
