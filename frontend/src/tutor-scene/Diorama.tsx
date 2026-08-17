import { useEffect, useMemo, useRef } from 'react';
import { Box3, Group, Vector3 } from 'three';
import { useSceneModel } from './useSceneModel';
import { sceneScale, SCENE_ASSETS, type SceneAsset } from './assets';
import type { QualitySettings } from './quality';
import { useGround } from './ground';

/*
 * The island a Tutor scene takes place on.
 *
 * Placement is MEASURED, not authored: both Meshy exports sit below y=0 (by
 * -0.24 and -0.41 units) and neither is centred on the origin. Rather than ask
 * an artist to re-export with a specific pivot — a request that gets forgotten
 * on the next asset — the component measures the loaded bounds, centres the
 * island on the origin and rests its UNDERSIDE on y=0.
 *
 * Deliberately the underside and not the top: the top of the bounds is the
 * back wall or the palm crowns, so landing that on y=0 put characters standing
 * in the air above the scenery. The walkable surface is found separately, by
 * raycast, in ground.tsx — which is also why this component registers itself
 * as the collidable ground.
 */

export interface DioramaProps {
  id: keyof typeof SCENE_ASSETS;
  settings: QualitySettings;
}

export function Diorama({ id, settings }: DioramaProps) {
  const asset: SceneAsset = SCENE_ASSETS[id];
  const { scene } = useSceneModel(asset.url, settings);
  const scale = useMemo(() => sceneScale(asset), [asset]);

  const offset = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    return new Vector3(-center.x * scale, -box.min.y * scale, -center.z * scale);
  }, [scene, scale]);

  const root = useRef<Group>(null);
  const { setGround } = useGround();

  useEffect(() => {
    setGround(root.current);
    return () => setGround(null);
  }, [setGround, scene]);

  return (
    <group ref={root} position={offset} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}
