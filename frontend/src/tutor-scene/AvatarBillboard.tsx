import { useEffect, useState } from 'react';
import { SRGBColorSpace, TextureLoader, type Texture } from 'three';

/*
 * Class III / S17 `presence` (TUTOR_INSTRUMENTS.md §3.4): "the learner's
 * existing avatar appears in the scene during a transaction." Confirmed by
 * research before writing this: nothing in this codebase has ever rendered
 * anything but one of the 4 rigged, authored `.glb` characters inside the 3D
 * canvas — the learner's own avatar is a DiceBear `avataaars` SVG data URI
 * (`frontend/src/components/Avatar.tsx`), 2D-only, with no 3D counterpart
 * anywhere. This is the coarse, honest version that infrastructure supports
 * TODAY: a camera-facing billboard (`THREE.Sprite`, which is always aimed at
 * the camera by construction — no per-frame lookAt code needed, and nothing
 * to get backwards) textured with that same SVG, standing recognizably in
 * the scene rather than a full rigged 3D reconstruction of an avatar that
 * was never designed to be one.
 *
 * LOADED IN A PLAIN EFFECT, DELIBERATELY NOT `useLoader` — found live, not
 * guessed, after `useLoader` produced a real, repeatable console error
 * (`WebGL: INVALID_VALUE: texSubImage2D: bad image data` /
 * `glTexImage2DRobustANGLE: Texture is immutable`) and pinned a live
 * headless-Chrome run's GPU process over 500% CPU. The proximate cause was
 * this component's own render body writing `texture.colorSpace =
 * SRGBColorSpace` directly onto the object `useLoader` returned — a MUTATION
 * DURING RENDER, which THREE.js reads as "this texture's encoding changed,
 * re-upload it," on EVERY re-render of `Cast` (frequent: mic state, live
 * captions, the standing cast) — retrying an upload against GL storage
 * already allocated as immutable the first time. A guard
 * (`if (texture.colorSpace !== SRGBColorSpace)`) was tried first and did NOT
 * fully close it — some remount/Suspense interaction this component's own
 * usage pattern hits still re-ran the mutation.
 *
 * This version sidesteps the whole class rather than patching the symptom:
 * the texture is created and configured EXACTLY ONCE, inside a `useEffect`
 * whose only dependency is the URL string itself, stored in ordinary
 * `useState`, and explicitly `dispose()`d on cleanup — no property of an
 * already-uploaded texture is ever touched again outside that one effect run.
 * `drei` is deliberately unused on this stage (/AGENTS.md's locked stack
 * table), so this is `TextureLoader` used directly, the way `useLoader`
 * itself does internally, minus the Suspense/cache layer that this specific
 * usage did not get right.
 */

const BILLBOARD_HEIGHT_M = 1.1;

function useAvatarTexture(avatarUri: string): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: Texture | null = null;
    const loader = new TextureLoader();
    loader.load(avatarUri, (tex) => {
      if (cancelled) {
        tex.dispose();
        return;
      }
      // Set ONCE, before the texture is ever handed to a render — never
      // touched again after this, which is the entire fix.
      tex.colorSpace = SRGBColorSpace;
      loaded = tex;
      setTexture(tex);
    });
    return () => {
      cancelled = true;
      loaded?.dispose();
      setTexture(null);
    };
  }, [avatarUri]);

  return texture;
}

function LoadedAvatarBillboard({
  avatarUri,
  position,
}: {
  avatarUri: string;
  position: readonly [number, number, number];
}) {
  const texture = useAvatarTexture(avatarUri);
  if (!texture) return null;

  return (
    <sprite position={[position[0], position[1] + BILLBOARD_HEIGHT_M / 2, position[2]]} scale={[BILLBOARD_HEIGHT_M, BILLBOARD_HEIGHT_M, 1]}>
      <spriteMaterial map={texture} transparent />
    </sprite>
  );
}

/**
 * Renders nothing while the texture is in flight or on a load failure —
 * exactly `Character3D`'s own posture for a still-loading or missing asset
 * (a missing presence is a bystander short one guest, never a broken scene).
 */
export function AvatarBillboard({
  avatarUri,
  position,
}: {
  /** A DiceBear `toDataUri()` string, or null when the learner has none set. */
  avatarUri: string | null;
  position: readonly [number, number, number];
}) {
  if (!avatarUri) return null;
  return <LoadedAvatarBillboard avatarUri={avatarUri} position={position} />;
}
