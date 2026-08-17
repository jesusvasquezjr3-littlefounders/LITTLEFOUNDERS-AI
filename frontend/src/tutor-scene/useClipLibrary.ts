import { useEffect, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AnimationClip } from 'three';
import { CLIP_LIBRARY_URL } from './clipLibrary';

/*
 * Loads the authored clip library ONCE for the whole app.
 *
 * Deliberately not `useLoader`: that suspends, and a suspended character inside
 * the Tutor's Suspense boundary would hold the entire stage — island included —
 * off screen until a file that is a GITIGNORED BUILD OUTPUT arrives. On a fresh
 * checkout that file does not exist at all, and a 404 there must degrade to
 * "no authored clips, use the procedural driver", never to a stage that does
 * not render.
 *
 * So the library loads out of band and the scene simply improves when it lands.
 */

type LibraryState = {
  clips: readonly AnimationClip[];
  /** Null while loading, then the outcome. Distinguishes "not yet" from "none". */
  status: 'loading' | 'ready' | 'unavailable';
};

const EMPTY: readonly AnimationClip[] = Object.freeze([]);

let cache: Promise<readonly AnimationClip[]> | null = null;

function loadOnce(): Promise<readonly AnimationClip[]> {
  if (cache) return cache;
  cache = new Promise((resolve) => {
    new GLTFLoader().load(
      CLIP_LIBRARY_URL,
      (gltf) => resolve(gltf.animations ?? EMPTY),
      undefined,
      () => {
        // Not an error worth throwing: the library is optional by design.
        // Report it once so a missing `npm run assets:clips` is visible to
        // whoever is wondering why the characters look procedural.
        console.info(
          `[tutor-scene] no authored clip library at ${CLIP_LIBRARY_URL} — ` +
            'characters fall back to the procedural driver. Run `npm run assets:clips`.',
        );
        resolve(EMPTY);
      },
    );
  });
  return cache;
}

export function useClipLibrary(): LibraryState {
  const [state, setState] = useState<LibraryState>({ clips: EMPTY, status: 'loading' });

  useEffect(() => {
    let alive = true;
    loadOnce().then((clips) => {
      if (!alive) return;
      setState({ clips, status: clips.length ? 'ready' : 'unavailable' });
    });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/** Test seam: drops the module-level cache so a suite can load twice. */
export function resetClipLibraryCache(): void {
  cache = null;
}
