import { useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import {
  Bone,
  ClampToEdgeWrapping,
  FrontSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  TextureLoader,
  type Object3D,
} from 'three';
import type { CharacterId } from '@/components/characters/control/types';
import {
  ATLAS_COLUMNS,
  ATLAS_ROWS,
  applyViseme,
  buildMouthGeometry,
  mouthAtlasUrl,
  mouthCardFor,
  toHeadLocal,
} from './mouthAtlas';

/*
 * A mouth laid over the character's painted one, parented to the head joint.
 *
 * The character cannot open its mouth: no facial bone exists on any export and
 * the mouth is texture, not geometry (/TUTOR_3D.md §3). This card is the mouth.
 *
 * It is deliberately NOT a flat quad — see `mouthAtlas.ts` — and it is parented
 * to the head JOINT rather than added to the scene graph beside the character,
 * so it inherits head rotation, the breathing idle, and the character's scale
 * without a single line of per-frame code.
 */

export interface MouthCardProps {
  id: CharacterId;
  /** The loaded character scene. */
  scene: Object3D;
  /** Base URL the character's own .glb was served from. */
  assetBase: string;
  /** Index into VISEMES. */
  viseme: number;
  /** Anisotropy from the active quality tier. */
  anisotropy: number;
}

/**
 * The head joint, by name.
 *
 * Exact match, not a suffix match: this skeleton also carries `head_end` and
 * `headfront`, and hanging the mouth off either would put it inside the skull
 * or a metre out in front of the face.
 */
function findHeadBone(root: Object3D): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((node) => {
    if (!found && (node as Bone).isBone && node.name.toLowerCase() === 'head') found = node;
  });
  return found;
}

export function MouthCard({ id, scene, assetBase, viseme, anisotropy }: MouthCardProps) {
  const card = useMemo(() => mouthCardFor(id), [id]);
  const texture = useLoader(TextureLoader, mouthAtlasUrl(assetBase, id));

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    /*
     * No mipmaps. The atlas packs eight frames edge to edge, and a mipmapped
     * atlas blends NEIGHBOURING frames into each other at distance — the mouth
     * would smear into the frame below it as the character walks away. The card
     * is a few dozen pixels on screen at worst, so the sharper minification is
     * not a cost worth paying to avoid.
     */
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.repeat.set(1 / ATLAS_COLUMNS, 1 / ATLAS_ROWS);
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
  }, [texture, anisotropy]);

  useEffect(() => {
    applyViseme(texture, viseme);
  }, [texture, viseme]);

  const mesh = useMemo(() => {
    if (!card) return null;
    const head = findHeadBone(scene);
    if (!head) return null;

    const geometry = buildMouthGeometry(card);
    toHeadLocal(geometry, head, scene);

    /*
     * UNLIT, and this is a known compromise rather than a preference.
     *
     * Every lit material renders this card SOLID BLACK over the mouth —
     * MeshStandardMaterial and MeshLambertMaterial alike — while the same
     * material with a flat `color` and no map lights up perfectly red. So the
     * scene's lights reach it, its normals point outward (checked: mean normal
     * agrees with the offset from the head joint), it is excluded from shadow
     * mapping, and it is front-side only. The failure is isolated to
     * "lit shader + this map" and the root cause is NOT yet found.
     *
     * Unlit is correct enough to ship because the atlas is painted with the
     * character's own ALBEDO, sampled from their texture — so the card shows
     * exactly the colour the face's material starts from. What it will not do
     * is darken with the face as the scene's lighting changes, which is a real
     * mismatch in dark mode and the reason this comment exists rather than
     * being quietly omitted.
     */
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      // The card sits 3.5 mm off the skin and has no thickness. Writing depth
      // would let it occlude the face's own silhouette at grazing angles for no
      // gain, since nothing is ever drawn between the card and the cheek.
      depthWrite: false,
      // A decal glued to a head has no back worth drawing.
      side: FrontSide,
    });

    const built = new Mesh(geometry, material);
    // Drawn after the face it covers. Without this the sort order depends on
    // load order and the card flickers behind the head.
    built.renderOrder = 1;
    built.frustumCulled = false;
    /*
     * The card takes no part in shadow mapping, and that is not an optimisation.
     *
     * It sits 3.5 mm off a surface that casts shadows, which is well inside the
     * depth bias of any shadow map — so on the `high` tier (the only one with
     * shadows) the face shadowed its own decal and the mouth rendered SOLID
     * BLACK. It read like a texture failure; it was self-shadow acne. A decal
     * glued to a surface should neither cast onto it nor receive from it.
     */
    built.castShadow = false;
    built.receiveShadow = false;
    built.name = `${id}-mouth-card`;
    return built;
  }, [card, scene, texture, id]);

  useEffect(() => {
    if (!mesh) return;
    const head = findHeadBone(scene);
    if (!head) return;
    head.add(mesh);
    return () => {
      head.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    };
  }, [mesh, scene]);

  return null;
}

/** Whether a character has a mouth card authored for it yet. */
export function hasMouthCard(id: CharacterId): boolean {
  return mouthCardFor(id) !== null;
}
