import { describe, expect, it } from 'vitest';
import {
  CLAY_EMISSIVE_FLOOR,
  CLAY_ROUGHNESS,
  CLAY_SPECULAR,
  relightAsClay,
  type ShadedMaterial,
} from './characterMaterial';

/** A stand-in for three's `Color` with only what the rule touches. */
function color(hex: number) {
  let value = hex;
  return {
    getHex: () => value,
    setRGB: (r: number, g: number, b: number) => {
      value = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    },
  };
}

const TEXTURE = { id: 'base-colour' };

/** Exactly what every character .glb ships today. */
function characterExport(): ShadedMaterial {
  return {
    map: TEXTURE,
    emissiveMap: TEXTURE,
    emissive: color(0xffffff),
    metalness: 1,
    roughness: 1,
    specularIntensity: 1,
  };
}

/** Exactly what the two islands ship: authored per-texel. */
function islandExport(): ShadedMaterial {
  return {
    map: TEXTURE,
    emissiveMap: null,
    emissive: color(0x000000),
    metalnessMap: { id: 'mr' },
    roughnessMap: { id: 'mr' },
    metalness: 1,
    roughness: 1,
  };
}

describe('relighting the cast as clay', () => {
  it('dims the self-illumination the exporter left on down to a floor', () => {
    const material = characterExport();
    const changed = relightAsClay(material);
    expect(changed.dimmedEmission).toBe(true);
    const floor = Math.round(CLAY_EMISSIVE_FLOOR * 255);
    expect(material.emissive!.getHex()).toBe((floor << 16) | (floor << 8) | floor);
    // The MAP stays bound: the floor has to be the character's own colour
    // dimmed, or a green dinosaur in the dark becomes a grey one.
    expect(material.emissiveMap).toBe(TEXTURE);
  });

  it('leaves a floor rather than a silhouette, because a character at night is not atmospheric', () => {
    const material = characterExport();
    relightAsClay(material);
    expect(CLAY_EMISSIVE_FLOOR).toBeGreaterThan(0);
    expect(CLAY_EMISSIVE_FLOOR).toBeLessThan(0.25);
  });

  it('turns a fully metallic character back into a diffuse surface', () => {
    const material = characterExport();
    const changed = relightAsClay(material);
    expect(changed.clearedMetalness).toBe(true);
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBe(CLAY_ROUGHNESS);
    expect(material.specularIntensity).toBe(CLAY_SPECULAR);
  });

  it('asks the renderer to recompile, once', () => {
    const material = characterExport();
    relightAsClay(material);
    expect(material.needsUpdate).toBe(true);
  });

  it('leaves an island alone, because its metalness is authored per-texel', () => {
    const material = islandExport();
    const changed = relightAsClay(material);
    expect(changed).toEqual({ dimmedEmission: false, clearedMetalness: false });
    expect(material.metalness).toBe(1);
    expect(material.roughness).toBe(1);
    expect(material.needsUpdate).toBeUndefined();
  });

  it('leaves a genuinely glowing part alone', () => {
    // A separate emissive texture is a decision somebody made — a visor, a
    // lantern — and is not the albedo-in-the-emissive-slot fingerprint.
    const material: ShadedMaterial = {
      map: TEXTURE,
      emissiveMap: { id: 'glow' },
      emissive: color(0xffffff),
      metalness: 0,
      roughness: 0.6,
    };
    const changed = relightAsClay(material);
    expect(changed.dimmedEmission).toBe(false);
    expect(material.emissive!.getHex()).toBe(0xffffff);
    expect(material.emissiveMap).toEqual({ id: 'glow' });
  });

  it('leaves a dimmed emissive alone, because a value that is not full white was chosen', () => {
    const material: ShadedMaterial = {
      map: TEXTURE,
      emissiveMap: TEXTURE,
      emissive: color(0x333333),
      metalness: 0,
      roughness: 0.6,
    };
    expect(relightAsClay(material).dimmedEmission).toBe(false);
  });

  it('is idempotent, so a quality-tier change cannot re-apply it', () => {
    const material = characterExport();
    relightAsClay(material);
    const second = relightAsClay(material);
    expect(second).toEqual({ dimmedEmission: false, clearedMetalness: false });
    expect(material.roughness).toBe(CLAY_ROUGHNESS);
  });

  it('survives a material with no specular slot at all', () => {
    // `MeshStandardMaterial` has no `specularIntensity`; writing one would add
    // a property three does not read and hide the fact that nothing happened.
    const material: ShadedMaterial = {
      map: TEXTURE,
      emissiveMap: TEXTURE,
      emissive: color(0xffffff),
      metalness: 1,
      roughness: 1,
    };
    relightAsClay(material);
    expect(material.specularIntensity).toBeUndefined();
    expect(material.metalness).toBe(0);
  });
});
