import { useEffect, useMemo } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
// `three/examples/jsm/...` rather than the shorter `three/addons/...` alias:
// both resolve to the same files, but @types/three only ships declarations
// under examples/jsm, so the alias would type-check as `any`.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Mesh, Object3D } from 'three';
import { relightAsClay, type ShadedMaterial } from './characterMaterial';
import type { QualitySettings } from './quality';

/*
 * Loads an optimized .glb produced by `npm run assets:3d`.
 *
 * Two compression schemes are in play and they solve different problems:
 *
 *   - MESHOPT for geometry. Chosen over Draco deliberately: Draco squeezes a
 *     few percent harder but needs an externally hosted decoder AND is
 *     markedly slower to decode. Decode time is device load too — on the
 *     low-end phones this whole system exists to serve, Draco's decode stall
 *     is a visible hitch on scene entry. Meshopt's decoder is a plain ES
 *     module, so Vite bundles it and there is nothing to host.
 *
 *   - KTX2/Basis for textures. This one is NOT about download size (WebP wins
 *     there) — it is about VRAM. A KTX2 texture stays GPU-compressed in
 *     memory; a PNG/WebP is decoded to full RGBA. On a 2GB phone that
 *     difference decides whether the scene loads at all.
 */

/** Module-level so repeated mounts reuse one transcoder instead of re-fetching the .wasm. */
let ktx2Singleton: KTX2Loader | null = null;

function getKtx2Loader(): KTX2Loader {
  if (!ktx2Singleton) {
    // Served from public/basis/ by scripts/copy-3d-decoders.mjs. The trailing
    // slash matters — KTX2Loader concatenates filenames onto this prefix.
    ktx2Singleton = new KTX2Loader().setTranscoderPath('/basis/');
  }
  return ktx2Singleton;
}

/**
 * Loads a model and applies the current quality tier to its materials.
 *
 * MUST be called from inside a `<Canvas>`: KTX2 support detection needs the
 * live renderer to know which GPU texture formats are actually available, and
 * guessing wrong yields corrupt textures rather than a clean failure.
 */
export function useSceneModel(url: string, settings: QualitySettings) {
  const gl = useThree((state) => state.gl);

  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.setKTX2Loader(getKtx2Loader().detectSupport(gl));
  });

  // Cloning would double VRAM for no benefit here — one scene instance is
  // exactly what the Tutor mounts — so the loaded scene is used directly.
  const scene = gltf.scene as Object3D;

  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = settings.shadows;
      mesh.receiveShadow = settings.shadows;

      // Anisotropy is per-texture and has real cost on mobile fill rate, so it
      // follows the tier rather than being left at the driver default.
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        /*
         * THE CAST TAKES THE LIGHT. Every character export ships
         * `metallicFactor: 1` with no metalness map and its own albedo in the
         * emissive slot at full white — which is an exporter's "unlit"
         * checkbox, and it is why one character read as solid and another as a
         * ghost while the island's four times of day reached neither of them.
         * The rule and its measurements are in `characterMaterial.ts`; it fires
         * only on that fingerprint, so the islands, which author metalness
         * per-texel, are untouched.
         *
         * It runs in this traverse rather than a second one because it is
         * idempotent and cheap: after the first pass the fingerprint no longer
         * matches, so a quality-tier change re-walks the graph and changes
         * nothing.
         */
        relightAsClay(material as unknown as ShadedMaterial);

        const map = (material as { map?: { anisotropy: number; needsUpdate: boolean } }).map;
        if (map && map.anisotropy !== settings.anisotropy) {
          map.anisotropy = settings.anisotropy;
          map.needsUpdate = true;
        }
      }
    });
  }, [scene, settings.shadows, settings.anisotropy]);

  return useMemo(() => ({ scene, animations: gltf.animations }), [scene, gltf.animations]);
}
