/**
 * Version of the illustration identity Forge is willing to inherit.
 *
 * Prism owns the two purpose-specific cache discriminators, but Vault needs one
 * bundle-level marker so a document can prove that its object tiles and scenes
 * were produced under the same approved visual generation. Bump this whenever
 * the learner-facing illustration look changes; legacy/null rows must never be
 * treated as free replacements for the current style.
 */
/*
 * 2026-08-14: the scene half moved v7 → v8 (identity brief no longer names a
 * subject; scene cache keys carry the lesson). The TILE half is unchanged, so
 * every cached object tile is still exactly what this build produces and
 * Prism serves it free. The composite still changes, which is intended: a
 * document stamped with the old pair is not a valid donor and is not
 * release-ready until its SCENES have been redrawn.
 */
export const FORGE_ILLUSTRATION_STYLE_VERSION =
  'v8-qwen-image-max-flat-vector-subject-true+v8-qwen-image-max-object-white-flat-vector';
