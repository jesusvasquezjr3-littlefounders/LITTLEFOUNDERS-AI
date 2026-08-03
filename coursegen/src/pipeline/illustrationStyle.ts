/**
 * Version of the illustration identity Forge is willing to inherit.
 *
 * Prism owns the two purpose-specific cache discriminators, but Vault needs one
 * bundle-level marker so a document can prove that its object tiles and scenes
 * were produced under the same approved visual generation. Bump this whenever
 * the learner-facing illustration look changes; legacy/null rows must never be
 * treated as free replacements for the current style.
 */
export const FORGE_ILLUSTRATION_STYLE_VERSION =
  'v7-qwen-image-max-flat-vector+v8-qwen-image-max-object-white-flat-vector';
