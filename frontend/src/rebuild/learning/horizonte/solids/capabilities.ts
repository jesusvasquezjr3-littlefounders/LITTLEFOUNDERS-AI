export const SOLIDS_CAPABILITIES = {
  'geometry.solid-viewer.v2': ['visual.solid-viewer.v1', 'operation.fixed-views.v1', 'operation.choose-and-count.v1'],
  'geometry.cube-net.v2': ['visual.cube-net.v1', 'operation.place-faces.v1', 'operation.fold-net.v1'],
  'geometry.cube-stack.v2': ['visual.cube-stack.v1', 'operation.stack-cubes.v1', 'operation.linked-views.v1'],
} as const;
