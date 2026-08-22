import type { CharacterId } from '@/components/characters/control/types';

/*
 * What the models ARE, measured. Nothing about where their bytes come from.
 *
 * This is split out of `assets.ts` for one concrete reason: that module reads
 * `import.meta.env` to resolve URLs, which only exists under Vite, so anything
 * importing it is confined to a bundler or a test runner. The numbers below are
 * facts about geometry — they are what a placement check, a footprint
 * calculation or a headless verification script actually needs, and none of
 * those has any business needing a build tool to read them.
 *
 * `scripts/verify-placement.ts` is the case that forced the issue: it runs the
 * real solver against the real islands with no browser, and it could not import
 * a single measured number without dragging in asset URL resolution.
 *
 * Every value here is MEASURED (`npm run assets:inspect`), never inferred from
 * a filename. They matter because the four characters did not come from one
 * pipeline: three measure 1.6–1.7 units, while Dina's export is in Unreal's
 * unit scale and measures 0.028.
 */

export interface CharacterMeasurement {
  id: CharacterId;
  /** Bind-pose height of the source export, in glTF units. */
  sourceHeightM: number;
  /**
   * Widest HORIZONTAL extent of the bind pose, in the same source units.
   * Measured per character, because it is not a function of height: Liruf's
   * tail makes him 1.03x as long as he is tall while Rho is 0.48x, and Dina is
   * 1.48x. Placement needs this — two characters whose footprints overlap
   * intersect, however good the standing spot underneath each of them is.
   */
  sourceFootprintM: number;
  /** Height this character should occupy in the scene, in metres. */
  targetHeightM: number;
  /**
   * Triangles in the OPTIMIZED export, from `npm run assets:inspect`.
   *
   * Recorded here, beside the other measured facts, because it is the number
   * that decides how many characters may stand on the island at once. The
   * personalization audition puts the whole cast on stage, and "the whole cast"
   * is a budget question before it is a design one: an answer computed from
   * these figures can be asserted in a unit test, whereas an answer reasoned
   * about in a review is how a scene ships at three times its frame ceiling.
   */
  triangles: number;
}

/*
 * Heights, decided from what the models ACTUALLY are (rendered and inspected,
 * not inferred from filenames):
 *
 *   rho   — adult human, moustache and glasses. Export already measures 1.70 m,
 *           so it is authoritative and scale stays 1.0.
 *   zara  — young woman. Export measures 1.61 m. Also authoritative.
 *   liruf — bipedal cartoon dinosaur, same export pipeline and unit scale as
 *           the two humans, so its 1.647 m is a deliberate design choice: a
 *           dino buddy who stands eye-to-eye with the cast. Kept.
 *   dina  — QUADRUPED, and the one true outlier: exported in Unreal's unit
 *           scale (0.0283 tall, 0.0417 long — deeper than tall, which is what
 *           gave the quadruped away). She is the BIGGEST character, not the
 *           smallest: 1.90 m tall makes her ~2.80 m long, so she reads as a
 *           large dinosaur beside a 1.70 m human rather than as a pet.
 *
 *           She was 0.70 m — "large-dog sized" — which was a guess about what a
 *           baby dino companion should be, not a decision anyone made. Owner
 *           correction 2026-08-16: Dina is a big character, clearly larger than
 *           Liruf. The ceiling is the island: `diorama-a` is 6.5 m across, and
 *           at 2.80 m long she already occupies 43% of it with a second
 *           character standing beside her.
 */
/*
 * The triangle counts below are wildly uneven and that is a measured fact, not
 * an oversight: `rho` and `liruf` came back from decimation at ~3.1k, while
 * `zara` and `dina` sit right on the 50k per-character ceiling. Two of the four
 * therefore cost sixteen times what the other two do, which is exactly why the
 * audition's budget has to be computed from real numbers rather than from "four
 * characters, that should be fine".
 */
export const CHARACTER_MEASUREMENTS: Readonly<Record<CharacterId, CharacterMeasurement>> =
  Object.freeze({
    dina: { id: 'dina', sourceHeightM: 0.028, sourceFootprintM: 0.04167, targetHeightM: 1.9, triangles: 49_997 },
    liruf: { id: 'liruf', sourceHeightM: 1.647, sourceFootprintM: 1.7, targetHeightM: 1.647, triangles: 3_132 },
    rho: { id: 'rho', sourceHeightM: 1.7, sourceFootprintM: 0.82109, targetHeightM: 1.7, triangles: 3_080 },
    zara: { id: 'zara', sourceHeightM: 1.61, sourceFootprintM: 0.82841, targetHeightM: 1.61, triangles: 49_999 },
  });

export interface SceneMeasurement {
  id: string;
  /** Widest horizontal extent of the source export, in glTF units. */
  sourceWidthM: number;
  /** Diameter this island should occupy in the scene, in metres. */
  targetWidthM: number;
  /** Triangles in the optimized export, from `npm run assets:inspect`. */
  triangles: number;
}

/*
 * Both dioramas are round floating islands about 1.9 units across as exported —
 * which would put a 1.7 m character nearly edge to edge and towering over the
 * scenery. They are scaled up to read as PLACES a person stands in: the stone
 * circle as an intimate plaza, the oasis larger because its palms need the
 * headroom to look like palms.
 */
export const SCENE_MEASUREMENTS = Object.freeze({
  'diorama-a': { id: 'diorama-a', sourceWidthM: 1.879, targetWidthM: 6.5, triangles: 44_996 },
  'diorama-b': { id: 'diorama-b', sourceWidthM: 1.896, targetWidthM: 9.5, triangles: 66_868 },
}) satisfies Record<string, SceneMeasurement>;

export type SceneId = keyof typeof SCENE_MEASUREMENTS;

/** Uniform scale that brings a character to its target height. */
export function characterScale(asset: CharacterMeasurement): number {
  return asset.targetHeightM / asset.sourceHeightM;
}

/** How much ground this character covers once scaled, in metres. */
export function characterFootprintM(asset: CharacterMeasurement): number {
  return asset.sourceFootprintM * characterScale(asset);
}

/** Uniform scale that brings an island to its target diameter. */
export function sceneScale(asset: SceneMeasurement): number {
  return asset.targetWidthM / asset.sourceWidthM;
}

/**
 * The floor on centre-to-centre distance between TWO specific characters.
 *
 * Per pair, not per cast, and that distinction is what lets the whole cast
 * stand on the small island. Dina covers 2.83 m and Liruf 1.70 m, so those two
 * genuinely need 2.61 m between them — but applying that same 2.61 m to Rho and
 * Zara, who cover 0.82 m each, reserves three times the ground they occupy.
 * Measured on `diorama-a` (6.5 m across): one global floor seated two of the
 * four candidates and reported NO SPOT FOUND for the other two, which is
 * precisely the empty-ground-under-a-name-plate bug in a different disguise.
 */
export function pairSeparationM(a: number, b: number): number {
  return Math.max(1.3, (a + b) / 2 + 0.35);
}

/**
 * The widest floor any pair in this cast needs.
 *
 * Used as the SCALE for "are these two standing together", not as the hard
 * gate — the gate is per pair (above). It lives here, beside the measurements
 * it is computed from, because `scripts/verify-placement.ts` has to solve with
 * the SAME rule the product solves with: it used to hold its own copy of this
 * arithmetic, and a gate that exercises a different configuration certifies a
 * different product.
 */
export function castSeparationM(footprints: readonly number[]): number {
  const widest = [...footprints].sort((a, b) => b - a);
  return pairSeparationM(widest[0] ?? 0, widest[1] ?? 0);
}

/**
 * Half the widest footprint on stage, used to PREFER roomy spots, never to
 * reject them: Dina covers 2.83 m of a 6.5 m island, so a hard requirement
 * could leave her with nowhere at all, and an empty island is a worse failure
 * than a character standing near the rim.
 */
export function castClearanceM(footprints: readonly number[]): number {
  return Math.max(0, ...footprints) / 2;
}
